import { getCurrentUser, rejectWithoutFamilySession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { RewardRule } from "@/lib/types";

export async function POST(request: Request) {
  const unauthorized = await rejectWithoutFamilySession();
  if (unauthorized) {
    return unauthorized;
  }

  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "parent") {
    return Response.json({ error: "Parent role is required." }, { status: 403 });
  }

  const body = await request.json();
  const rule: RewardRule = {
    id: `rule-${body.studentId}-${Date.now()}`,
    title: String(body.title ?? "Reward").trim(),
    description: String(body.description ?? "").trim(),
    triggerType: body.triggerType === "score_growth" ? "score_growth" : "attendance_count",
    targetValue: Number(body.targetValue ?? 1),
    rewardAmount: Number(body.rewardAmount ?? 0),
    status: "active"
  };

  if (!rule.title || !Number.isFinite(rule.rewardAmount) || rule.rewardAmount < 1 || !Number.isFinite(rule.targetValue) || rule.targetValue < 1) {
    return Response.json({ error: "Title, reward amount, and target value are required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(rule);
  }

  const { data, error } = await supabase
    .from("reward_rules")
    .insert({
      student_id: body.studentId,
      title: rule.title,
      description: rule.description,
      trigger_type: rule.triggerType,
      target_value: rule.targetValue,
      reward_amount: rule.rewardAmount,
      status: rule.status
    })
    .select("*")
    .single();

  if (error || !data) {
    return Response.json(rule);
  }

  return Response.json({
    id: data.id,
    title: data.title,
    description: data.description ?? "",
    triggerType: data.trigger_type,
    targetValue: data.target_value,
    rewardAmount: data.reward_amount ?? rule.rewardAmount,
    status: data.status
  });
}
