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

export const RISING_STREAK_BONUS_REASON = "5일 연속 점수 상승 보너스";
export const RISING_STREAK_BONUS_AMOUNT = 5000;
export const RISING_STREAK_MIN_DAYS = 5;

export type BonusGrant = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type DualModeBonusGrant = BonusGrant;

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

/* ---------------------------------------------------------------- *
 * Rising-streak bonus
 *
 * If the student's per-day best score has been strictly rising for
 * RISING_STREAK_MIN_DAYS days in a row, grant +5,000 once. Dedup is
 * windowed: if a streak bonus was already granted in the last
 * RISING_STREAK_MIN_DAYS days, skip — that covers the same streak
 * extending past the minimum. A future streak starting after a
 * broken day gets its own bonus.
 * ---------------------------------------------------------------- */
export async function maybeGrantRisingStreakBonus(
  studentId: string
): Promise<BonusGrant | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const cutoffDays = 45;
  const cutoffMs = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;
  const cutoffISO = new Date(cutoffMs).toISOString();

  const { data: snapshots } = await supabase
    .from("evaluation_snapshots")
    .select("evaluated_at, overall_score")
    .eq("student_id", studentId)
    .gte("evaluated_at", cutoffISO)
    .order("evaluated_at", { ascending: true });

  if (!snapshots || snapshots.length === 0) return null;

  const byDate = new Map<string, number>();
  for (const s of snapshots) {
    const date = String(s.evaluated_at).slice(0, 10);
    const score = Number(s.overall_score ?? 0);
    byDate.set(date, Math.max(byDate.get(date) ?? 0, score));
  }

  const dayScores = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, score]) => score);

  if (dayScores.length < RISING_STREAK_MIN_DAYS) return null;

  let streak = 1;
  for (let i = dayScores.length - 1; i > 0; i--) {
    if (dayScores[i] > dayScores[i - 1]) {
      streak += 1;
    } else {
      break;
    }
  }

  if (streak < RISING_STREAK_MIN_DAYS) return null;

  const today = new Date().toISOString().slice(0, 10);
  const windowStart = new Date(
    Date.now() - RISING_STREAK_MIN_DAYS * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

  const { data: existing } = await supabase
    .from("reward_ledger")
    .select("id")
    .eq("student_id", studentId)
    .eq("reason", RISING_STREAK_BONUS_REASON)
    .gte("created_at", `${windowStart}T00:00:00+00:00`)
    .lte("created_at", `${today}T23:59:59+00:00`)
    .limit(1);

  if (existing && existing.length > 0) return null;

  const { data: ledger, error } = await supabase
    .from("reward_ledger")
    .insert({
      student_id: studentId,
      source_type: "skill_milestone",
      amount: RISING_STREAK_BONUS_AMOUNT,
      reason: RISING_STREAK_BONUS_REASON
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
