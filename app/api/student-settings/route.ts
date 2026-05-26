import { getCurrentUser, rejectWithoutFamilySession } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard";
import { getSupabaseAdmin } from "@/lib/supabase";
import { clearCachedTask } from "@/lib/task-generator";

/* ----------------------------------------------------------------------------
 * POST /api/student-settings
 * Body: { studentId, usGradeLevel, cefrLevel?, levelDescription? }
 *
 * Parents-only. Verifies the target student is in the caller's family by
 * checking they appear in their own dashboard load, then writes to the
 * `students` row and invalidates today's task cache so the next student
 * visit regenerates prompts against the new grade.
 * -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  const unauthorized = await rejectWithoutFamilySession();
  if (unauthorized) return unauthorized;

  const user = await getCurrentUser();
  if (!user || user.role !== "parent") {
    return Response.json({ error: "Parent role required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    studentId?: string;
    usGradeLevel?: string;
    cefrLevel?: string;
    levelDescription?: string;
  };

  const studentId = String(body.studentId ?? "").trim();
  const usGradeLevel = String(body.usGradeLevel ?? "").trim();
  if (!studentId || !usGradeLevel) {
    return Response.json(
      { error: "studentId and usGradeLevel are required" },
      { status: 400 }
    );
  }

  const dashboard = await loadDashboardData(user);
  const entry = dashboard.students.find((s) => s.student.id === studentId);
  if (!entry) {
    return Response.json({ error: "Student not in your family" }, { status: 404 });
  }

  const cefrLevel = body.cefrLevel?.trim() || entry.student.cefrLevel;
  const levelDescription = body.levelDescription?.trim() ?? "";

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Demo mode: echo the updated profile back without persistence.
    return Response.json({
      id: studentId,
      displayName: entry.student.displayName,
      email: entry.student.email,
      cefrLevel,
      usGradeLevel,
      levelDescription
    });
  }

  const { data, error } = await supabase
    .from("students")
    .update({
      us_grade_level: usGradeLevel,
      cefr_level: cefrLevel,
      level_description: levelDescription
    })
    .eq("id", studentId)
    .select("*")
    .single();

  if (error || !data) {
    return Response.json({ error: "Update failed" }, { status: 500 });
  }

  // Drop today's cached task so the next /student visit regenerates prompts
  // against the new grade standard.
  clearCachedTask(studentId, "speaking");
  clearCachedTask(studentId, "writing");

  return Response.json({
    id: data.id,
    displayName: data.display_name,
    email: data.email,
    cefrLevel: data.cefr_level,
    usGradeLevel: data.us_grade_level,
    levelDescription: data.level_description ?? ""
  });
}
