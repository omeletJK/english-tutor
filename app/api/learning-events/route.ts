import { getCurrentUser, rejectWithoutFamilySession } from "@/lib/auth";
import { ensureDefaultStudent } from "@/lib/dashboard";
import { demoStudents } from "@/lib/demo-data";
import { evaluateLearningEvent } from "@/lib/openai";
import { maybeGrantDualModeBonus, maybeGrantRisingStreakBonus } from "@/lib/rewards";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clearCachedTask, generateAdaptiveTask, setCachedTask, type StudentContext } from "@/lib/task-generator";
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
    // Drop today's cached task so a fresh prompt is generated for the same day.
    const today = new Date().toISOString().slice(0, 10);
    clearCachedTask(student.id, body.mode, today);
    const demoNextTask = await generateAdaptiveTask({
      mode: body.mode,
      context: mergeSkillStatesIntoContext(priorContext, evaluation.skillStates),
      date: today
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
  const today = new Date().toISOString().slice(0, 10);

  // Pull every prompt already used today for this mode (just-completed + any
  // earlier skipped) so the next prompt picks a different topic.
  const { data: priorRows } = await supabase
    .from("daily_tasks")
    .select("prompt")
    .eq("student_id", student.id)
    .eq("task_date", today)
    .eq("mode", body.mode)
    .in("status", ["skipped", "completed"]);
  const avoidPrompts = (priorRows ?? [])
    .map((row: { prompt: string | null }) => (row.prompt ?? "").trim())
    .filter(Boolean);

  // Force a brand-new prompt for the same date — bypass any stale cache.
  clearCachedTask(student.id, body.mode, today);
  const nextTask = await generateAdaptiveTask({
    mode: body.mode,
    context: updatedContext,
    date: today,
    avoidPrompts
  });

  const { data: insertedNext } = await supabase
    .from("daily_tasks")
    .insert({
      student_id: student.id,
      task_date: today,
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

  setCachedTask(student.id, body.mode, persistedNextTask, today);

  const dualModeBonus = await maybeGrantDualModeBonus(student.id);
  const risingStreakBonus = await maybeGrantRisingStreakBonus(student.id);

  return Response.json({
    ...evaluation,
    nextTask: persistedNextTask,
    dualModeBonus,
    risingStreakBonus
  });
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
