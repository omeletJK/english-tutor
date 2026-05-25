import { createDemoDashboard, demoStudents } from "@/lib/demo-data";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  generateAdaptiveTask,
  getCachedTask,
  setCachedTask,
  type StudentContext
} from "@/lib/task-generator";
import type {
  DailyTask,
  DashboardData,
  EvaluationSnapshot,
  FamilyUser,
  LessonHistoryItem,
  MemoryNote,
  Observation,
  ProgressPoint,
  SkillState,
  SpeakingAttempt,
  Student,
  StudentDashboard,
  TaskMode
} from "@/lib/types";

type FamilySupabase = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export async function loadDashboardData(currentUser: FamilyUser): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const demo = createDemoDashboard(currentUser);
    return await applyAdaptiveTasks(demo);
  }

  if (currentUser.role === "parent") {
    const { data: studentRows } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: true });

    const rows = studentRows ?? [];
    if (rows.length === 0) {
      const demo = createDemoDashboard(currentUser);
      return await applyAdaptiveTasks(demo);
    }

    const entries = await Promise.all(
      rows.map((row) => buildStudentEntry(supabase, mapStudent(row), { generateMissingTasks: false }))
    );

    return {
      currentUser,
      activeStudentId: rows[0].id,
      students: entries
    };
  }

  const student = await ensureDefaultStudent(currentUser);
  if (!student) {
    return await applyAdaptiveTasks(createDemoDashboard(currentUser));
  }

  const entry = await buildStudentEntry(supabase, student, { generateMissingTasks: true });

  return {
    currentUser,
    activeStudentId: student.id,
    students: [entry]
  };
}

async function buildStudentEntry(
  supabase: FamilySupabase,
  student: Student,
  opts: { generateMissingTasks: boolean }
): Promise<StudentDashboard> {
  const today = new Date().toISOString().slice(0, 10);
  const fallback = pickDemoFallback(student);

  const [
    todayTasksResult,
    observationsResult,
    skillsResult,
    eventsResult,
    speakingAttemptsResult,
    snapshotsResult,
    memoryNotesResult
  ] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("*")
      .eq("student_id", student.id)
      .eq("task_date", today)
      .eq("status", "assigned")
      .order("created_at", { ascending: false }),
    supabase
      .from("observations")
      .select("*")
      .eq("student_id", student.id)
      .eq("status", "active")
      .order("last_seen", { ascending: false })
      .limit(12),
    supabase
      .from("skill_states")
      .select("*")
      .eq("student_id", student.id)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("learning_events")
      .select("*, daily_tasks(prompt)")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("speaking_attempts")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("evaluation_snapshots")
      .select("*")
      .eq("student_id", student.id)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("memory_notes")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  const recentObservations = (observationsResult.data ?? []).map(mapObservation);
  const skillStates = (skillsResult.data ?? []).map(mapSkillState);
  const todayTasks = (todayTasksResult.data ?? []).map(mapDailyTask);
  const lessonHistory = (eventsResult.data ?? []).map(mapLessonHistoryItem);
  const speakingAttempts = (speakingAttemptsResult.data ?? []).map(mapSpeakingAttempt);
  const evaluationSnapshots = (snapshotsResult.data ?? []).map(mapEvaluationSnapshot);
  const memoryNotes = (memoryNotesResult.data ?? []).map(mapMemoryNote);

  const context: StudentContext = {
    student,
    skillStates: skillStates.length ? skillStates : fallback.skillStates,
    recentObservations: recentObservations.length ? recentObservations : fallback.recentObservations
  };

  const existingSpeaking = todayTasks.find((t) => t.mode === "speaking");
  const existingWriting = todayTasks.find((t) => t.mode === "writing");

  const speakingTask = opts.generateMissingTasks
    ? await ensureTodayTask({
        supabase,
        studentId: student.id,
        today,
        mode: "speaking",
        existing: existingSpeaking,
        context
      })
    : existingSpeaking ?? fallback.speakingTask;

  const writingTask = opts.generateMissingTasks
    ? await ensureTodayTask({
        supabase,
        studentId: student.id,
        today,
        mode: "writing",
        existing: existingWriting,
        context
      })
    : existingWriting ?? fallback.writingTask;

  const progressPoints = buildProgressPointsFromSnapshots(evaluationSnapshots, fallback.progressPoints);

  return {
    student,
    todayTask: speakingTask,
    speakingTask,
    writingTask,
    recentObservations,
    skillStates,
    lessonHistory,
    progressPoints,
    evaluationSnapshots,
    speakingAttempts,
    memoryNotes,
    rewardRules: fallback.rewardRules,
    weeklySummary: fallback.weeklySummary
  };
}

function pickDemoFallback(student: Student) {
  const byName = demoStudents.find(
    (entry) => entry.student.displayName.toLowerCase() === student.displayName.toLowerCase()
  );
  return byName ?? demoStudents[0];
}

function buildProgressPointsFromSnapshots(
  snapshots: EvaluationSnapshot[],
  fallback: ProgressPoint[]
): ProgressPoint[] {
  if (snapshots.length === 0) {
    return fallback;
  }

  const byDate = new Map<string, { speaking?: number; writing?: number; order: number }>();
  let order = 0;
  for (const s of [...snapshots].reverse()) {
    if (!byDate.has(s.date)) {
      byDate.set(s.date, { order: order++ });
    }
    const entry = byDate.get(s.date)!;
    if (s.mode === "speaking") entry.speaking = s.overallScore;
    if (s.mode === "writing") entry.writing = s.overallScore;
  }

  const sorted = Array.from(byDate.entries()).sort((a, b) => a[1].order - b[1].order);
  return sorted.map(([date, scores]) => ({
    date,
    speaking: scores.speaking ?? 0,
    writing: scores.writing ?? 0,
    confidence: Math.max(scores.speaking ?? 0, scores.writing ?? 0)
  }));
}

async function ensureTodayTask(args: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  studentId: string;
  today: string;
  mode: TaskMode;
  existing: DailyTask | undefined;
  context: StudentContext;
}): Promise<DailyTask> {
  if (args.existing) {
    setCachedTask(args.studentId, args.mode, args.existing, args.today);
    return args.existing;
  }

  const task = await generateAdaptiveTask({ mode: args.mode, context: args.context, date: args.today });

  if (args.supabase) {
    const { data } = await args.supabase
      .from("daily_tasks")
      .insert({
        student_id: args.studentId,
        task_date: args.today,
        mode: task.mode,
        prompt: task.prompt,
        target_skills: task.targetSkills,
        reward_value: task.rewardValue,
        generated_reason: task.generatedReason,
        success_criteria: task.successCriteria,
        status: "assigned"
      })
      .select("*")
      .single();

    if (data) {
      const persisted = mapDailyTask(data);
      setCachedTask(args.studentId, args.mode, persisted, args.today);
      return persisted;
    }
  }

  return task;
}

async function applyAdaptiveTasks(dashboard: DashboardData): Promise<DashboardData> {
  const today = new Date().toISOString().slice(0, 10);

  const students = await Promise.all(
    dashboard.students.map(async (entry) => {
      const context: StudentContext = {
        student: entry.student,
        skillStates: entry.skillStates,
        recentObservations: entry.recentObservations
      };

      const [speakingTask, writingTask] = await Promise.all([
        getCachedTask(entry.student.id, "speaking", today) ??
          generateAdaptiveTask({ mode: "speaking", context, date: today }),
        getCachedTask(entry.student.id, "writing", today) ??
          generateAdaptiveTask({ mode: "writing", context, date: today })
      ]);

      return {
        ...entry,
        speakingTask,
        writingTask,
        todayTask: speakingTask
      };
    })
  );

  return { ...dashboard, students };
}

export function buildStudentContext(entry: StudentDashboard): StudentContext {
  return {
    student: entry.student,
    skillStates: entry.skillStates,
    recentObservations: entry.recentObservations
  };
}

export async function ensureDefaultStudent(currentUser?: FamilyUser): Promise<Student | null> {
  const supabase = getSupabaseAdmin();
  const fallback = demoStudents.find((entry) => entry.student.id === currentUser?.studentId) ?? demoStudents[0];

  if (!supabase) {
    return fallback.student;
  }

  const email = currentUser?.email ?? fallback.student.email;

  const { data: existing } = await supabase
    .from("students")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    await linkFamilyUserToStudent(supabase, email, existing.id);
    return mapStudent(existing);
  }

  const { data, error } = await supabase
    .from("students")
    .insert({
      display_name: currentUser?.displayName ?? fallback.student.displayName,
      email,
      cefr_level: fallback.student.cefrLevel,
      us_grade_level: fallback.student.usGradeLevel,
      level_description: fallback.student.levelDescription
    })
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  await linkFamilyUserToStudent(supabase, email, data.id);

  return mapStudent(data);
}

async function linkFamilyUserToStudent(
  supabase: FamilySupabase,
  email: string,
  studentId: string
) {
  await supabase
    .from("family_users")
    .update({ student_id: studentId })
    .eq("email", email)
    .is("student_id", null);
}

function mapStudent(row: Record<string, any>): Student {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    cefrLevel: row.cefr_level ?? "A1+",
    usGradeLevel: row.us_grade_level ?? "Grade 5",
    levelDescription: row.level_description ?? ""
  };
}

function mapDailyTask(row: Record<string, any>): DailyTask {
  return {
    id: row.id,
    prompt: row.prompt,
    mode: row.mode,
    targetSkills: row.target_skills ?? [],
    rewardValue: row.reward_value ?? 1,
    generatedReason: row.generated_reason ?? "",
    successCriteria: row.success_criteria ?? []
  };
}

function mapObservation(row: Record<string, any>): Observation {
  return {
    id: row.id,
    type: row.type,
    skill: row.skill,
    claim: row.claim,
    confidence: Number(row.confidence ?? 0),
    lastSeen: row.last_seen
  };
}

function mapSkillState(row: Record<string, any>): SkillState {
  return {
    id: row.id,
    skill: row.skill,
    level: row.level,
    score: Number(row.score ?? 0),
    signals: row.signals ?? [],
    nextTargets: row.next_targets ?? []
  };
}

function mapLessonHistoryItem(row: Record<string, any>): LessonHistoryItem {
  const score = Number(
    row.feedback_json?.attempt?.score ??
      row.feedback_json?.evaluationSnapshot?.overallScore ??
      row.feedback_json?.overallScore ??
      row.feedback_json?.score ??
      60
  );

  const prompt =
    row.daily_tasks?.prompt ??
    row.feedback_json?.attempt?.topic ??
    (row.mode === "speaking" ? row.topic : undefined);

  return {
    id: row.id,
    date: String(row.created_at).slice(0, 10),
    mode: row.mode,
    title: row.topic ?? prompt ?? (row.mode === "writing" ? "Writing quest" : "Speaking quest"),
    score,
    prompt: typeof prompt === "string" ? prompt : undefined,
    rawInput: typeof row.raw_input === "string" ? row.raw_input : undefined
  };
}

function mapSpeakingAttempt(row: Record<string, any>): SpeakingAttempt {
  return {
    id: row.id,
    date: String(row.created_at).slice(0, 10),
    topic: row.topic ?? "",
    transcript: row.transcript ?? "",
    score: Number(row.score ?? 0),
    metrics: Array.isArray(row.metrics) ? row.metrics : [],
    feedbackSections: Array.isArray(row.feedback_sections) ? row.feedback_sections : [],
    referenceSentences: Array.isArray(row.reference_sentences) ? row.reference_sentences : [],
    memoryNotes: []
  };
}

function mapEvaluationSnapshot(row: Record<string, any>): EvaluationSnapshot {
  return {
    id: row.id,
    date: formatShortDate(row.evaluated_at),
    mode: row.mode,
    overallScore: Number(row.overall_score ?? 0),
    metrics: Array.isArray(row.metrics) ? row.metrics : [],
    strengths: Array.isArray(row.strengths) ? row.strengths : [],
    needsPractice: Array.isArray(row.needs_practice) ? row.needs_practice : []
  };
}

function mapMemoryNote(row: Record<string, any>): MemoryNote {
  return {
    id: row.id,
    date: String(row.created_at).slice(0, 10),
    type: row.type,
    claim: row.claim,
    evidence: row.evidence
  };
}

function formatShortDate(timestamp: string): string {
  const slice = String(timestamp).slice(5, 10);
  const [mm, dd] = slice.split("-");
  return `${Number(mm)}/${dd}`;
}
