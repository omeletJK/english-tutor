import type { DailyTask, Observation, SkillState, Student, TaskMode } from "@/lib/types";

export type StudentContext = {
  student: Student;
  skillStates: SkillState[];
  recentObservations: Observation[];
};

type GenerateInput = {
  mode: TaskMode;
  context: StudentContext;
  date?: string;
};

const taskCache = new Map<string, DailyTask>();

function cacheKey(studentId: string, date: string, mode: TaskMode) {
  return `${studentId}:${date}:${mode}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getCachedTask(studentId: string, mode: TaskMode, date = todayKey()): DailyTask | undefined {
  return taskCache.get(cacheKey(studentId, date, mode));
}

export function setCachedTask(studentId: string, mode: TaskMode, task: DailyTask, date = todayKey()) {
  taskCache.set(cacheKey(studentId, date, mode), task);
}

export async function generateAdaptiveTask(input: GenerateInput): Promise<DailyTask> {
  const date = input.date ?? todayKey();
  const cached = getCachedTask(input.context.student.id, input.mode, date);
  if (cached) {
    return cached;
  }

  const task = process.env.OPENAI_API_KEY
    ? await callOpenAIForTask(input).catch(() => fallbackAdaptiveTask(input))
    : fallbackAdaptiveTask(input);

  setCachedTask(input.context.student.id, input.mode, task, date);
  return task;
}

function evaluationModel() {
  return process.env.OPENAI_EVALUATION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
}

async function callOpenAIForTask(input: GenerateInput): Promise<DailyTask> {
  const { mode, context } = input;
  const { student, skillStates, recentObservations } = context;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: evaluationModel(),
      instructions:
        mode === "speaking"
          ? [
              "You are an expert English tutor. Write ONE open thinking question that a real human teacher would ask a child at the given CEFR/grade level for a 30-90 second spoken answer.",
              "The question must invite the student to think and form their own answer. It should not dictate sentence structure.",
              "STRICTLY FORBIDDEN: fill-in-blank templates ('I see a ___'), required first sentences, numbered sentence checklists ('1) ... 2) ... 3) ...'), 'choose a starter', word banks, or any scaffolding that pre-builds the answer for the student.",
              "Calibrate difficulty by topic abstraction and response length expectation, NOT by adding scaffolds. Lower levels get more concrete, personal topics; higher levels get opinions, comparisons, hypotheticals, or short arguments.",
              "The prompt should be 1-2 sentences total. Tell the student what to think about, not how to phrase the answer.",
              "Return only valid JSON."
            ].join(" ")
          : [
              "You are an expert English tutor. Write ONE open thinking question that a real human teacher would assign for a short written paragraph (4-8 sentences) at the given CEFR/grade level.",
              "The question must invite the student to organize their own thoughts. It should not dictate sentence structure.",
              "STRICTLY FORBIDDEN: fill-in-blank templates ('I see a ___'), required first sentences, numbered sentence checklists ('1) ... 2) ... 3) ...'), 'choose a starter', word banks, or any scaffolding that pre-builds the paragraph for the student.",
              "Calibrate difficulty by topic abstraction and expected paragraph length, NOT by adding scaffolds. Lower levels: concrete personal topics (a memory, a favorite thing) with reasons. Mid levels: comparisons, descriptions of experiences with explanation. Higher levels: opinions with arguments, hypotheticals, what-would-you-do scenarios.",
              "The prompt should be 1-2 sentences total. Tell the student what to think about, not how to phrase the paragraph.",
              "Return only valid JSON."
            ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task_mode: mode,
                student: {
                  displayName: student.displayName,
                  cefrLevel: student.cefrLevel,
                  usGradeLevel: student.usGradeLevel,
                  levelDescription: student.levelDescription
                },
                skillStates: skillStates.map((s) => ({
                  skill: s.skill,
                  level: s.level,
                  score: s.score,
                  signals: s.signals,
                  nextTargets: s.nextTargets
                })),
                recentObservations: recentObservations.map((o) => ({
                  type: o.type,
                  skill: o.skill,
                  claim: o.claim,
                  confidence: o.confidence,
                  lastSeen: o.lastSeen
                })),
                today: todayKey(),
                authoring_rules: [
                  "Speaking and writing tasks for the same student MUST differ in topic and cognitive demand. Do not mirror them. If this is a writing task, do not produce an opinion question that would also work verbally — pick a topic that genuinely benefits from being written out.",
                  "Match the student's CEFR level precisely. A1 ≈ very simple personal/concrete; A2 ≈ familiar topics with reasons; B1 ≈ opinions and short arguments; B2+ ≈ abstract or comparative analysis.",
                  "Match the student's US grade equivalent. A Grade 5 student is 10-11 years old — do NOT use Grade 1 sentence frames. A Grade 7+ student is 12+ — they can handle opinions and hypotheticals.",
                  "Use the student's recent observations and interests as topic seeds. Avoid repeating last week's topics.",
                  "Target at most two skills, and they must appear in targetSkills as snake_case.",
                  "Korean generatedReason must reference a specific skill_state or observation that justifies this task today.",
                  "Korean successCriteria are evaluation hints, not sentence templates. Keep them about thinking outcomes (e.g., '이유 2개를 서로 다른 측면에서 제시') not phrasing rules."
                ],
                example_good_prompts: {
                  speaking_A1: "What did you eat today that you really liked, and why?",
                  speaking_A2: "If your best friend visited your home for one day, what would you show them first and why?",
                  speaking_B1: "Do you think students learn more from books or from real experiences? Pick one and explain.",
                  writing_A2: "Think of a person in your life who taught you something important. Describe who they are and what you learned from them.",
                  writing_B1: "Some schools are removing letter grades. Do you agree with this idea? Give your reasons and one example.",
                  writing_B2: "Imagine you could change one thing about how your school works. What would you change, and how would your school be different a year later?"
                },
                example_bad_prompts: [
                  "Look around you and pick ONE thing you can see. Answer with 4 sentences: 1) I see a ____. 2) It is ____ (color). 3) It is in/on/under ____. 4) I like it because ____.",
                  "Write three sentences. Start with 'I like'. Use because.",
                  "Choose a starter: 'I see a book.' or 'I see a cup.'"
                ],
                requested_shape: {
                  mode: "speaking | writing",
                  prompt: "1-2 sentence open thinking question, no scaffolds",
                  targetSkills: ["snake_case skill"],
                  rewardValue: 1,
                  generatedReason: "Korean: which skill_state or observation this targets today",
                  successCriteria: ["Korean thinking outcome", "Korean thinking outcome"]
                }
              })
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error("openai task generation failed");
  }

  const payload = await response.json();
  const text = extractOutputText(payload);
  const parsed = JSON.parse(text);

  return normalizeGeneratedTask(parsed, input);
}

function normalizeGeneratedTask(parsed: any, input: GenerateInput): DailyTask {
  const prompt = typeof parsed.prompt === "string" && parsed.prompt.trim() ? parsed.prompt.trim() : null;
  if (!prompt) {
    return fallbackAdaptiveTask(input);
  }

  const targetSkills = Array.isArray(parsed.targetSkills)
    ? parsed.targetSkills.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];

  const successCriteria = Array.isArray(parsed.successCriteria)
    ? parsed.successCriteria.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];

  return {
    id: `task-${input.mode}-${input.context.student.id}-${input.date ?? todayKey()}`,
    mode: input.mode,
    prompt,
    targetSkills: targetSkills.length ? targetSkills : ["sentence_expansion"],
    rewardValue: 1,
    generatedReason:
      typeof parsed.generatedReason === "string" && parsed.generatedReason.trim()
        ? parsed.generatedReason.trim()
        : `${input.context.student.displayName} 학생의 현재 ${input.context.student.cefrLevel} 단계에 맞춘 ${input.mode === "speaking" ? "말하기" : "쓰기"} 과제입니다.`,
    successCriteria: successCriteria.length ? successCriteria : defaultSuccessCriteria(input.mode)
  };
}

function defaultSuccessCriteria(mode: TaskMode) {
  return mode === "speaking"
    ? ["자신의 입장이나 경험이 분명히 드러나기", "이유나 예시를 최소 한 개 자신의 말로 설명하기"]
    : ["글 전체에 하나의 분명한 생각이 흐르기", "이유나 예시가 자신의 경험과 연결되기"];
}

function extractOutputText(payload: any): string {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }
  const chunks: string[] = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

export function fallbackAdaptiveTask(input: GenerateInput): DailyTask {
  const { mode, context } = input;
  const { student, skillStates, recentObservations } = context;
  const weakest = pickWeakestSkill(skillStates);
  const interest = pickInterestTopic(recentObservations);
  const grade = parseGradeNumber(student.usGradeLevel);

  const prompt = buildFallbackPrompt({ mode, grade, weakest, interest });

  return {
    id: `task-fallback-${mode}-${student.id}-${input.date ?? todayKey()}`,
    mode,
    prompt,
    targetSkills: weakest ? [weakest.skill] : ["sentence_expansion"],
    rewardValue: 1,
    generatedReason: buildFallbackReason({ student, weakest }),
    successCriteria: defaultSuccessCriteria(mode)
  };
}

function pickWeakestSkill(skillStates: SkillState[]) {
  if (!skillStates.length) return null;
  const writingFriendly = skillStates.find((s) => /writing|grammar|sentence|vocab|paragraph/i.test(s.skill));
  const speakingFriendly = skillStates.find((s) => /speaking|fluen|reason|interaction|confidence/i.test(s.skill));
  return [...skillStates]
    .sort((a, b) => a.score - b.score)[0] ?? writingFriendly ?? speakingFriendly ?? skillStates[0];
}

function pickInterestTopic(observations: Observation[]) {
  return observations.find((o) => o.type === "interest")?.claim ?? null;
}

function parseGradeNumber(label: string): number {
  const match = /(\d+)/.exec(label ?? "");
  return match ? Number(match[1]) : 5;
}

function buildFallbackPrompt(args: { mode: TaskMode; grade: number; weakest: SkillState | null; interest: string | null }) {
  const { mode, grade, interest } = args;
  const topicSeed = interest ? extractTopicSeed(interest) : null;

  const speakingByLevel: Record<"low" | "mid" | "high", string[]> = {
    low: [
      "What is one thing you enjoyed doing today, and why did you enjoy it?",
      "If you could spend an afternoon doing anything, what would you choose, and why?",
      "Tell me about a person who makes you happy and one reason why."
    ],
    mid: [
      "What is one skill you want to get better at this year, and how could you practice it?",
      "Would you rather live by the ocean or in the mountains? Pick one and explain your thinking.",
      "Describe a recent moment when you felt proud of yourself. What happened, and why did it matter to you?"
    ],
    high: [
      "Do you think students learn more from making mistakes or from getting things right the first time? Take a side and explain.",
      "If you could change one rule at your school, what would it be and how would things be different?",
      "What is something many people believe that you disagree with? Explain why."
    ]
  };

  const writingByLevel: Record<"low" | "mid" | "high", string[]> = {
    low: [
      "Think of a place that feels comfortable to you. Describe what it looks like and why it feels that way.",
      "Write about a small moment from this week that you want to remember. Explain what happened and how you felt.",
      "Describe a person you trust. What are they like, and why do you trust them?"
    ],
    mid: [
      "Think of something you used to find difficult but no longer do. Explain what changed for you.",
      "Describe a tradition or routine in your family that means something to you. What is it, and why does it matter?",
      "Write about a choice you made recently that you are still thinking about. What was the choice, and why does it stay with you?"
    ],
    high: [
      "Some people say technology is making us less patient. Do you agree? Use examples from your own life.",
      "Imagine you could redesign one part of school life. What would you change, and what would be better one year later?",
      "Write about a belief you used to hold but no longer do. What changed your mind?"
    ]
  };

  const band = grade <= 3 ? "low" : grade <= 6 ? "mid" : "high";
  const pool = mode === "speaking" ? speakingByLevel[band] : writingByLevel[band];
  const seedHash = (topicSeed ?? `${mode}-${args.weakest?.skill ?? ""}`).length;
  const pick = pool[seedHash % pool.length];
  return pick;
}

function extractTopicSeed(claim: string): string | null {
  const match = claim.match(/[가-힣A-Za-z ,]+/);
  if (!match) return null;
  const cleaned = match[0].trim();
  return cleaned.length > 0 ? cleaned.split(/[,.]/)[0].trim() : null;
}

function buildFallbackReason(args: { student: Student; weakest: SkillState | null }) {
  const { student, weakest } = args;
  if (weakest) {
    return `${student.displayName} 학생의 ${weakest.skill} 점수가 ${weakest.score}점이라 해당 영역을 강화하는 과제로 선택했습니다.`;
  }
  return `${student.displayName} 학생의 ${student.cefrLevel} 수준에 맞춘 일일 과제입니다.`;
}
