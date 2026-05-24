import { getCurrentUser, rejectWithoutFamilySession } from "@/lib/auth";
import { loadDashboardData } from "@/lib/dashboard";
import { summarizeStudentDevelopment } from "@/lib/openai";

export async function POST(request: Request) {
  const unauthorized = await rejectWithoutFamilySession();
  if (unauthorized) {
    return unauthorized;
  }

  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "parent") {
    return Response.json({ error: "Parent role is required." }, { status: 403 });
  }

  const body = (await request.json()) as { studentId?: string };
  const studentId = String(body.studentId ?? "");
  if (!studentId) {
    return Response.json({ error: "studentId is required." }, { status: 400 });
  }

  const dashboard = await loadDashboardData(currentUser);
  const entry = dashboard.students.find((item) => item.student.id === studentId);
  if (!entry) {
    return Response.json({ error: "Student not found." }, { status: 404 });
  }

  const summary = await summarizeStudentDevelopment({
    displayName: entry.student.displayName,
    cefrLevel: entry.student.cefrLevel,
    usGradeLevel: entry.student.usGradeLevel,
    observations: entry.recentObservations,
    skillStates: entry.skillStates,
    recentSnapshots: entry.evaluationSnapshots,
    recentSpeakingAttempts: entry.speakingAttempts
  });

  return Response.json({ summary });
}
