import { getSupabaseAdmin } from "@/lib/supabase";

/* ---------------------------------------------------------------- *
 * Daily dual-mode bonus
 *
 * If a student has at least one Speaking evaluation AND one Writing
 * evaluation today, and BOTH days' best scores are ≥ 90, grant a
 * one-time bonus of 1,000 points to the reward_ledger. Dedup is
 * enforced by checking for today's bonus row with the same reason.
 *
 * Call this from every place that inserts a new evaluation_snapshot
 * (learning-events route + speaking-attempts route) so the bonus
 * fires as soon as the threshold is crossed.
 * ---------------------------------------------------------------- */

export const DUAL_MODE_BONUS_REASON = "오늘 Writing·Speaking 모두 90점 보너스";
export const DUAL_MODE_BONUS_AMOUNT = 1000;
export const DUAL_MODE_SCORE_THRESHOLD = 90;

export type DualModeBonusGrant = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export async function maybeGrantDualModeBonus(
  studentId: string
): Promise<DualModeBonusGrant | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const today = new Date().toISOString().slice(0, 10);
  const dayStart = `${today}T00:00:00+00:00`;
  const dayEnd = `${today}T23:59:59+00:00`;

  const { data: snapshots } = await supabase
    .from("evaluation_snapshots")
    .select("mode, overall_score")
    .eq("student_id", studentId)
    .gte("evaluated_at", dayStart)
    .lte("evaluated_at", dayEnd);

  if (!snapshots || snapshots.length === 0) return null;

  const bestByMode = { speaking: 0, writing: 0 };
  for (const s of snapshots) {
    const score = Number(s.overall_score ?? 0);
    if (s.mode === "speaking" && score > bestByMode.speaking) bestByMode.speaking = score;
    if (s.mode === "writing" && score > bestByMode.writing) bestByMode.writing = score;
  }

  if (
    bestByMode.speaking < DUAL_MODE_SCORE_THRESHOLD ||
    bestByMode.writing < DUAL_MODE_SCORE_THRESHOLD
  ) {
    return null;
  }

  const { data: existing } = await supabase
    .from("reward_ledger")
    .select("id")
    .eq("student_id", studentId)
    .eq("reason", DUAL_MODE_BONUS_REASON)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .maybeSingle();

  if (existing) return null;

  const { data: ledger, error } = await supabase
    .from("reward_ledger")
    .insert({
      student_id: studentId,
      source_type: "skill_milestone",
      amount: DUAL_MODE_BONUS_AMOUNT,
      reason: DUAL_MODE_BONUS_REASON
    })
    .select("*")
    .single();

  if (error || !ledger) return null;

  return {
    id: ledger.id,
    amount: ledger.amount,
    reason: ledger.reason,
    createdAt: ledger.created_at
  };
}
