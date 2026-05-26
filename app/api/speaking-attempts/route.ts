import { getCurrentUser, rejectWithoutFamilySession } from "@/lib/auth";
import { ensureDefaultStudent } from "@/lib/dashboard";
import { evaluateSpeakingAttempt } from "@/lib/openai";
import { maybeGrantDualModeBonus, maybeGrantRisingStreakBonus } from "@/lib/rewards";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const unauthorized = await rejectWithoutFamilySession();
  if (unauthorized) {
    return unauthorized;
  }

  const currentUser = await getCurrentUser();
  const student = await ensureDefaultStudent(currentUser ?? undefined);
  if (!student) {
    return Response.json({ error: "Student profile is unavailable." }, { status: 500 });
  }

  const formData = await request.formData();
  const audio = formData.get("audio");
  const topic = String(formData.get("topic") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const attemptNumber = Number(formData.get("attemptNumber") ?? 1);
  const previousScore = Number(formData.get("previousScore") ?? 0) || undefined;

  const result = await evaluateSpeakingAttempt({
    audio: audio instanceof File ? audio : null,
    studentId: student.id,
    taskId,
    topic,
    attemptNumber,
    previousScore,
    student
  });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(result);
  }

  const { data: event } = await supabase
    .from("learning_events")
    .insert({
      student_id: student.id,
      task_id: taskId || null,
      mode: "speaking",
      topic,
      raw_input: result.attempt.transcript,
      summary: result.attempt.feedbackSections.map((section) => `${section.title}: ${section.notes.join(" ")}`).join("\n"),
      feedback_json: result
    })
    .select("*")
    .single();

  if (event) {
    await supabase.from("evaluation_snapshots").insert({
      student_id: student.id,
      event_id: event.id,
      mode: "speaking",
      overall_score: result.evaluationSnapshot.overallScore,
      metrics: result.evaluationSnapshot.metrics,
      strengths: result.evaluationSnapshot.strengths,
      needs_practice: result.evaluationSnapshot.needsPractice
    });

    await supabase.from("observations").insert(
      result.observations.map((observation) => ({
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

    await supabase.from("speaking_attempts").insert({
      student_id: student.id,
      event_id: event.id,
      topic,
      transcript: result.attempt.transcript,
      score: result.attempt.score,
      metrics: result.attempt.metrics,
      feedback_sections: result.attempt.feedbackSections,
      reference_sentences: result.attempt.referenceSentences
    });

    await supabase.from("memory_notes").insert(
      result.memoryNotes.map((note) => ({
        student_id: student.id,
        event_id: event.id,
        type: note.type,
        claim: note.claim,
        evidence: note.evidence
      }))
    );
  }

  const dualModeBonus = await maybeGrantDualModeBonus(student.id);
  const risingStreakBonus = await maybeGrantRisingStreakBonus(student.id);

  return Response.json({ ...result, dualModeBonus, risingStreakBonus });
}
