import { getCurrentUser, rejectWithoutFamilySession } from "@/lib/auth";
import { ensureDefaultStudent } from "@/lib/dashboard";
import { demoStudents } from "@/lib/demo-data";
import { evaluateLearningEvent } from "@/lib/openai";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateAdaptiveTask, setCachedTask, type StudentContext } from "@/lib/task-generator";
import type { LearningEventRequest, Observation, SkillState, Student } from "@/lib/types";

export async function POST(request: Request) {
  const unauthorized = await rejectWithoutFamilySession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as LearningEventRequest;
  const currentUser = await getCurrentUser();

  if (!body.answer || body.answer.trim().length < 2) {
    return Response.json({ error: "Answer is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const student = await ensureDefaultStudent(currentUser ?? undefined);

  if (!student) {
    return Response.json({ error: "Student profile is unavailable." }, { status: 500 });
  }

  const priorContext = await loadStudentContext(student);

  const evaluation = await evaluateLearningEvent({
    ...body,
    studentId: student.id,
    studentContext: priorContext
  });

  if (!supabase) {
    const demoNextTask = await generateAdaptiveTask({
      mode: body.mode,
      context: mergeSkillStatesIntoContext(priorContext, evaluation.skillStates),
      date: tomorrowDate()
    });
    return Response.json({ ...evaluation, nextTask: demoNextTask });
  }

  const { data: event } = await supabase
    .from("learning_events")
    .insert({
      student_id: student.id,
      task_id: body.taskId === "demo-task-today" ? null : body.taskId,
      mode: body.mode,
      raw_input: body.answer,
      summary: evaluation.parentNote,
      feedback_json: evaluation
    })
    .select("*")
    .single();

  if (event) {
    await supabase.from("observations").insert(
      evaluation.observations.map((observation) => ({
        student_id: student.id,
        event_id: event.id,
        type: observation.type,
        skill: observation.skill,
        claim: observation.claim,
        confidence: observation.confidence,
        first_seen: observation.lastSeen,
        last_seen: observation.lastSeen,
        status: "active"
      }))
    );

    if (evaluation.evaluationSnapshot) {
      await supabase.from("evaluation_snapshots").insert({
        student_id: student.id,
        event_id: event.id,
        mode: evaluation.evaluationSnapshot.mode,
        overall_score: evaluation.evaluationSnapshot.overallScore,
        metrics: evaluation.evaluationSnapshot.metrics,
        strengths: evaluation.evaluationSnapshot.strengths,
        needs_practice: evaluation.evaluationSnapshot.needsPractice
      });
    }
  }

  for (const skillState of evaluation.skillStates) {
    await supabase.from("skill_states").upsert(
      {
        student_id: student.id,
        skill: skillState.skill,
        level: skillState.level,
        score: skillState.score,
        signals: skillState.signals,
        next_targets: skillState.nextTargets,
        updated_at: new Date().toISOString()
      },
      { onConflict: "student_id,skill" }
    );
  }

  await supabase
    .from("daily_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", body.taskId)
    .eq("student_id", student.id);

  const updatedContext = await loadStudentContext(student);
  const tomorrow = tomorrowDate();

  const nextTask = await generateAdaptiveTask({
    mode: body.mode,
    context: updatedContext,
    date: tomorrow
  });

  const { data: insertedNext } = await supabase
    .from("daily_tasks")
    .insert({
      student_id: student.id,
      task_date: tomorrow,
      mode: nextTask.mode,
      prompt: nextTask.prompt,
      target_skills: nextTask.targetSkills,
      reward_value: nextTask.rewardValue,
      generated_reason: nextTask.generatedReason,
      success_criteria: nextTask.successCriteria,
      status: "assigned"
    })
    .select("*")
    .single();

  const persistedNextTask = insertedNext
    ? {
        id: insertedNext.id,
        mode: insertedNext.mode,
        prompt: insertedNext.prompt,
        targetSkills: insertedNext.target_skills ?? [],
        rewardValue: insertedNext.reward_value ?? 1,
        generatedReason: insertedNext.generated_reason ?? "",
        successCriteria: insertedNext.success_criteria ?? []
      }
    : nextTask;

  setCachedTask(student.id, body.mode, persistedNextTask, tomorrow);

  return Response.json({
    ...evaluation,
    nextTask: persistedNextTask
  });
}

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function loadStudentContext(student: Student): Promise<StudentContext> {
  const supabase = getSupabaseAdmin();
  const fallback = demoStudents.find((entry) => entry.student.id === student.id) ?? demoStudents[0];

  if (!supabase) {
    return {
      student,
      skillStates: fallback.skillStates,
      recentObservations: fallback.recentObservations
    };
  }

  const [skillsResult, observationsResult] = await Promise.all([
    supabase
      .from("skill_states")
      .select("*")
      .eq("student_id", student.id)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("observations")
      .select("*")
      .eq("student_id", student.id)
      .eq("status", "active")
      .order("last_seen", { ascending: false })
      .limit(8)
  ]);

  const skillStates: SkillState[] = (skillsResult.data ?? []).map((row: any) => ({
    id: row.id,
    skill: row.skill,
    level: row.level,
    score: Number(row.score ?? 0),
    signals: row.signals ?? [],
    nextTargets: row.next_targets ?? []
  }));

  const recentObservations: Observation[] = (observationsResult.data ?? []).map((row: any) => ({
    id: row.id,
    type: row.type,
    skill: row.skill,
    claim: row.claim,
    confidence: Number(row.confidence ?? 0),
    lastSeen: row.last_seen
  }));

  return {
    student,
    skillStates: skillStates.length ? skillStates : fallback.skillStates,
    recentObservations: recentObservations.length ? recentObservations : fallback.recentObservations
  };
}

function mergeSkillStatesIntoContext(context: StudentContext, fresh: SkillState[]): StudentContext {
  if (!fresh.length) return context;
  const map = new Map(context.skillStates.map((s) => [s.skill, s]));
  for (const item of fresh) {
    map.set(item.skill, item);
  }
  return { ...context, skillStates: Array.from(map.values()) };
}
