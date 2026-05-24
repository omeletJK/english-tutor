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
  FamilyUser,
  LessonHistoryItem,
  Observation,
  SkillState,
  Student,
  StudentDashboard,
  TaskMode
} from "@/lib/types";

export async function loadDashboardData(currentUser: FamilyUser): Promise<DashboardData> {
  const supabase = getSupabaseAdmin();

  if (!supabase || currentUser.role === "parent") {
    const demo = createDemoDashboard(currentUser);
    return await applyAdaptiveTasks(demo);
  }

  const student = await ensureDefaultStudent(currentUser);
  if (!student) {
    return await applyAdaptiveTasks(createDemoDashboard(currentUser));
  }

  const today = new Date().toISOString().slice(0, 10);

  const [
    todayTasksResult,
    observationsResult,
    skillsResult,
    eventsResult
  ] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("*")
      .eq("student_id", student.id)
      .eq("task_date", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("observations")
      .select("*")
      .eq("student_id", student.id)
      .eq("status", "active")
      .order("last_seen", { ascending: false })
      .limit(8),
    supabase
      .from("skill_states")
      .select("*")
      .eq("student_id", student.id)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("learning_events")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(8)
  ]);

  const fallback = demoStudents.find((entry) => entry.student.id === currentUser.studentId) ?? demoStudents[0];
  const recentObservations = (observationsResult.data ?? []).map(mapObservation);
  const skillStates = (skillsResult.data ?? []).map(mapSkillState);
  const todayTasks = (todayTasksResult.data ?? []).map(mapDailyTask);

  const context: StudentContext = {
    student,
    skillStates: skillStates.length ? skillStates : fallback.skillStates,
    recentObservations: recentObservations.length ? recentObservations : fallback.recentObservations
  };

  const speakingTask = await ensureTodayTask({
    supabase,
    studentId: student.id,
    today,
    mode: "speaking",
    existing: todayTasks.find((t) => t.mode === "speaking"),
    context
  });

  const writingTask = await ensureTodayTask({
    supabase,
    studentId: student.id,
    today,
    mode: "writing",
    existing: todayTasks.find((t) => t.mode === "writing"),
    context
  });

  const studentDashboard: StudentDashboard = {
    student,
    todayTask: speakingTask,
    speakingTask,
    writingTask,
    recentObservations,
    skillStates,
    lessonHistory: (eventsResult.data ?? []).map(mapLessonHistoryItem),
    progressPoints: fallback.progressPoints,
    evaluationSnapshots: fallback.evaluationSnapshots,
    speakingAttempts: fallback.speakingAttempts,
    memoryNotes: fallback.memoryNotes,
    rewardRules: fallback.rewardRules,
    weeklySummary: fallback.weeklySummary
  };

  return {
    currentUser,
    activeStudentId: student.id,
    students: [studentDashboard]
  };
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

  return mapStudent(data);
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
  const score = Number(row.feedback_json?.score ?? row.feedback_json?.overallScore ?? 60);

  return {
    id: row.id,
    date: String(row.created_at).slice(0, 10),
    mode: row.mode,
    title: row.topic ?? (row.mode === "writing" ? "Writing quest" : "Speaking quest"),
    score
  };
}
