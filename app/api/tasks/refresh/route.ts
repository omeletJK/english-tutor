import { getCurrentUser, rejectWithoutFamilySession } from "@/lib/auth";
import { ensureDefaultStudent } from "@/lib/dashboard";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  clearCachedTask,
  generateAdaptiveTask,
  setCachedTask,
  type StudentContext
} from "@/lib/task-generator";
import { demoStudents } from "@/lib/demo-data";
import type { Observation, SkillState, Student, TaskMode } from "@/lib/types";

export async function POST(request: Request) {
  const unauthorized = await rejectWithoutFamilySession();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as { mode?: TaskMode };
  const mode: TaskMode = body.mode === "writing" ? "writing" : "speaking";

  const currentUser = await getCurrentUser();
  const student = await ensureDefaultStudent(currentUser ?? undefined);
  if (!student) {
    return Response.json({ error: "Student profile is unavailable." }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const context = await loadStudentContext(student);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    // Retire any still-assigned tasks for today/mode so the new one wins.
    await supabase
      .from("daily_tasks")
      .update({ status: "skipped" })
      .eq("student_id", student.id)
      .eq("task_date", today)
      .eq("mode", mode)
      .eq("status", "assigned");
  }

  // Collect every prompt the student has already seen today for this mode so
  // the next generation truly rotates topics (the previous behaviour rephrased
  // because the model never knew what it had just produced).
  let avoidPrompts: string[] = [];
  if (supabase) {
    const { data: priorRows } = await supabase
      .from("daily_tasks")
      .select("prompt")
      .eq("student_id", student.id)
      .eq("task_date", today)
      .eq("mode", mode)
      .in("status", ["skipped", "completed"]);
    avoidPrompts = (priorRows ?? [])
      .map((row: { prompt: string | null }) => (row.prompt ?? "").trim())
      .filter(Boolean);
  }

  clearCachedTask(student.id, mode, today);
  const task = await generateAdaptiveTask({ mode, context, date: today, avoidPrompts });

  if (supabase) {
    const { data } = await supabase
      .from("daily_tasks")
      .insert({
        student_id: student.id,
        task_date: today,
        mode: task.mode,
        prompt: task.prompt,
        target_skills: task.targetSkills,
        reward_value: task.rewardValue,
        generated_reason: task.generatedReason,
        success_criteria: task.successCriteria,
        domain: task.domain ?? null,
        status: "assigned"
      })
      .select("*")
      .single();

    if (data) {
      const persisted = {
        id: data.id,
        mode: data.mode as TaskMode,
        prompt: data.prompt,
        targetSkills: data.target_skills ?? [],
        rewardValue: data.reward_value ?? 1,
        generatedReason: data.generated_reason ?? "",
        successCriteria: data.success_criteria ?? [],
        domain: data.domain ?? undefined
      };
      setCachedTask(student.id, mode, persisted, today);
      return Response.json({ task: persisted });
    }
  }

  setCachedTask(student.id, mode, task, today);
  return Response.json({ task });
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
