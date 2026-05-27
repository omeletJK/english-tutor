import { getCurrentUser, rejectWithoutFamilySession } from "@/lib/auth";
import { summarizeStudentDevelopment, type StudentDevelopmentInput } from "@/lib/openai";

type SummaryRequest = Partial<StudentDevelopmentInput>;

export async function POST(request: Request) {
  const unauthorized = await rejectWithoutFamilySession();
  if (unauthorized) {
    return unauthorized;
  }

  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "parent") {
    return Response.json({ error: "Parent role is required." }, { status: 403 });
  }

  // The client already has the full dashboard in memory — accept the snapshot
  // directly so we don't pay for a second loadDashboardData (which was
  // re-running 20 Supabase queries on every Overview mount).
  const body = (await request.json()) as SummaryRequest;
  if (!body.displayName || !body.cefrLevel || !body.usGradeLevel) {
    return Response.json({ error: "Missing student snapshot." }, { status: 400 });
  }

  const summary = await summarizeStudentDevelopment({
    displayName: body.displayName,
    cefrLevel: body.cefrLevel,
    usGradeLevel: body.usGradeLevel,
    observations: body.observations ?? [],
    skillStates: body.skillStates ?? [],
    recentSnapshots: body.recentSnapshots ?? [],
    recentSpeakingAttempts: body.recentSpeakingAttempts ?? []
  });

  return Response.json({ summary });
}
