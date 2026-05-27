import { curriculumSnippet, gradeMetaFromLabel } from "@/lib/curriculum";
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
  /** Prompts already shown to the student today for this mode. The new
   *  prompt MUST address a different topic — not a rephrasing. */
  avoidPrompts?: string[];
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

export function clearCachedTask(studentId: string, mode: TaskMode, date = todayKey()) {
  taskCache.delete(cacheKey(studentId, date, mode));
}

export async function generateAdaptiveTask(input: GenerateInput): Promise<DailyTask> {
  const date = input.date ?? todayKey();
  const cached = getCachedTask(input.context.student.id, input.mode, date);
  if (cached) {
    return cached;
  }

  // Try OpenAI twice (empty/invalid responses happen ~10-20% of the time on
  // gpt-5.4-mini with our larger instructions) before giving up to fallback.
  const task = process.env.OPENAI_API_KEY
    ? await callOpenAIForTask(input).catch(() =>
        callOpenAIForTask(input).catch(() => fallbackAdaptiveTask(input))
      )
    : fallbackAdaptiveTask(input);

  setCachedTask(input.context.student.id, input.mode, task, date);
  return task;
}

function evaluationModel() {
  return process.env.OPENAI_EVALUATION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
}

/* ------------------------------------------------------------------------- *
 * Domain pools per school band. The model is told to pick a domain FIRST
 * (declared in requested_shape.domain), and to rotate away from any domain
 * already represented in recent_prompts_to_avoid. This is what actually
 * makes "다른 주제 받기" jump across subjects (science / philosophy /
 * school / news / …) instead of producing another classroom-rules variant.
 * ------------------------------------------------------------------------- */
const DOMAIN_POOLS: Record<"elementary" | "middle" | "high", string[]> = {
  elementary: [
    "school life",
    "family & home",
    "friends",
    "hobbies & games",
    "food & cooking",
    "nature & animals",
    "weather & seasons",
    "sports & play",
    "art & music",
    "holidays & traditions",
    "imagination & future",
    "books & stories"
  ],
  middle: [
    "school life",
    "family & relationships",
    "hobbies & creative interests",
    "nature & environment",
    "science & discovery",
    "technology in daily life",
    "ethics & fairness",
    "news & current events",
    "arts, books & media",
    "history & culture",
    "sports & health",
    "future & big questions",
    "money & responsibility",
    "neighborhood & community"
  ],
  high: [
    "society & community",
    "philosophy & big questions",
    "ethics & moral dilemmas",
    "current events & news",
    "science & innovation",
    "technology's impact on society",
    "arts, literature & media",
    "history & culture",
    "economics, work & money",
    "personal identity & belief",
    "global issues & politics",
    "human nature & psychology",
    "education & learning itself",
    "environment & climate"
  ]
};

async function callOpenAIForTask(input: GenerateInput): Promise<DailyTask> {
  const { mode, context } = input;
  const { student, skillStates, recentObservations } = context;
  const gradeMeta = gradeMetaFromLabel(student.usGradeLevel);
  const curriculumStandard = curriculumSnippet(gradeMeta.key, mode);
  const domainPool = DOMAIN_POOLS[gradeMeta.schoolBand];
  const avoidPrompts = input.avoidPrompts ?? [];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: evaluationModel(),
      instructions:
        (mode === "speaking"
          ? "You are an expert English tutor. Write ONE open thinking question that a real human teacher would ask a child at the given CEFR/grade level for a 30-90 second spoken answer. The question must invite the student to think and form their own answer. It should not dictate sentence structure. STRICTLY FORBIDDEN: fill-in-blank templates, required first sentences, numbered sentence checklists, 'choose a starter', word banks, or any scaffolding. Calibrate difficulty by topic abstraction and response length, NOT by scaffolds. 1-2 sentence prompt total. Return only valid JSON."
          : "You are an expert English tutor. Write ONE open thinking question that a real human teacher would assign for a short written paragraph (4-8 sentences) at the given CEFR/grade level. The question must invite the student to organize their own thoughts. STRICTLY FORBIDDEN: fill-in-blank templates, required first sentences, numbered sentence checklists, 'choose a starter', word banks, or any scaffolding. Calibrate difficulty by topic abstraction and expected paragraph length. 1-2 sentence prompt total. Return only valid JSON.") +
        " DOMAIN ROTATION IS MANDATORY. Before writing the prompt, pick ONE domain from the user message's domain_pool and set requested_shape.domain to that exact string. The chosen domain MUST be different from the dominant subject of every entry in recent_prompts_to_avoid. If avoided prompts are about school life or classroom rules, you MUST jump to a clearly different bucket — examples: science & discovery, nature & environment, philosophy & big questions, news & current events, arts/books/media, ethics, technology, history. Do NOT pick another school-life angle. The new prompt's subject must be immediately recognizable as different from anything in recent_prompts_to_avoid. This rule overrides any preference for school topics.",
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
                  schoolBand: gradeMeta.schoolBand,
                  stageLabel: gradeMeta.stageLabel,
                  levelDescription: student.levelDescription,
                  curriculumStandard
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
                recent_prompts_to_avoid: avoidPrompts,
                domain_pool: domainPool,
                authoring_rules: [
                  "STEP 1 — DOMAIN FIRST. Before writing the prompt, choose ONE domain from domain_pool. Set requested_shape.domain to that exact string. The chosen domain MUST be different from the dominant domain of every entry in recent_prompts_to_avoid. If the avoided prompts cluster around 'school life' or 'classroom rules', the new domain MUST be from a clearly different bucket — e.g., 'science & discovery', 'nature & environment', 'philosophy & big questions', 'news & current events', 'arts, books & media'. Do NOT re-use the same domain from a slightly different angle.",
                  "STEP 2 — WRITE THE PROMPT inside the chosen domain. The reader should immediately recognize the subject as different from the avoided prompts. No rephrasing. No same-subject-different-verb.",
                  "Speaking and writing tasks for the same student MUST differ in topic and cognitive demand. If this is a writing task, do not produce an opinion question that would also work verbally — pick a topic that genuinely benefits from being written out.",
                  "Match the student's CEFR level precisely. A1 ≈ very simple personal/concrete; A2 ≈ familiar topics with reasons; B1 ≈ opinions and short arguments; B2+ ≈ abstract or comparative analysis.",
                  "Match the student's US grade equivalent. A Grade 5 student is 10-11 years old — do NOT use Grade 1 sentence frames. A Grade 7+ student is 12+ — they can handle opinions and hypotheticals.",
                  "Calibrate the prompt's cognitive load to student.curriculumStandard (CCSS-aligned grade expectations). Do not invent expectations beyond the listed grade; do not soften below it. Do not cite standard codes back to the student.",
                  "Use the student's recent observations and interests as topic seeds only when they fit the rotated domain. Avoid repeating last week's topics.",
                  "Target at most two skills, and they must appear in targetSkills as snake_case.",
                  "Korean generatedReason must reference a specific skill_state or observation that justifies this task today AND mention the chosen domain in Korean (e.g., '과학·발견 분야로 주제를 돌려 …').",
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
                  domain: "exact string from domain_pool — DECIDE THIS FIRST, must rotate away from recent_prompts_to_avoid",
                  mode: "speaking | writing",
                  prompt: "1-2 sentence open thinking question, no scaffolds, anchored in the chosen domain",
                  targetSkills: ["snake_case skill"],
                  rewardValue: 1,
                  generatedReason: "Korean: cite the rotated domain + a specific skill_state or observation",
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
  if (!text || text.trim().length === 0) {
    throw new Error("openai empty response");
  }
  const parsed = JSON.parse(text);

  const normalized = normalizeGeneratedTask(parsed, input);
  // If the model dropped the prompt entirely, treat as failure so the retry
  // can fire — normalizeGeneratedTask would otherwise quietly hand back a
  // fallback task that bypasses our retry path.
  if (!normalized.prompt || normalized.prompt.trim().length === 0) {
    throw new Error("openai returned no prompt text");
  }
  return normalized;
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

  // Only accept domains the prompt is allowed to claim — guards against the
  // model inventing a label outside the school-band pool.
  const gradeMeta = gradeMetaFromLabel(input.context.student.usGradeLevel);
  const allowedDomains = DOMAIN_POOLS[gradeMeta.schoolBand];
  const rawDomain = typeof parsed.domain === "string" ? parsed.domain.trim() : "";
  const domain = allowedDomains.includes(rawDomain) ? rawDomain : undefined;

  return {
    id: `task-${input.mode}-${input.context.student.id}-${input.date ?? todayKey()}`,
    mode: input.mode,
    prompt,
    targetSkills: targetSkills.length ? targetSkills : ["sentence_expansion"],
    rewardValue: 1,
    generatedReason:
      typeof parsed.generatedReason === "string" && parsed.generatedReason.trim()
        ? parsed.generatedReason.trim()
        : `${input.context.student.displayName} 학생의 ${gradeMeta.stageLabel}(CEFR ${gradeMeta.cefrEquivalent})에 맞춘 ${input.mode === "speaking" ? "말하기" : "쓰기"} 과제입니다.`,
    successCriteria: successCriteria.length ? successCriteria : defaultSuccessCriteria(input.mode),
    domain
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
  const { mode, context, avoidPrompts } = input;
  const { student, skillStates, recentObservations } = context;
  const weakest = pickWeakestSkill(skillStates);
  const interest = pickInterestTopic(recentObservations);
  const grade = parseGradeNumber(student.usGradeLevel);
  const date = input.date ?? todayKey();

  const picked = buildFallbackPrompt({
    mode,
    grade,
    weakest,
    interest,
    date,
    studentId: student.id,
    avoidPrompts
  });

  return {
    id: `task-fallback-${mode}-${student.id}-${date}`,
    mode,
    prompt: picked.prompt,
    targetSkills: weakest ? [weakest.skill] : ["sentence_expansion"],
    rewardValue: 1,
    generatedReason: buildFallbackReason({ student, weakest }),
    successCriteria: defaultSuccessCriteria(mode),
    domain: picked.domain
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

function buildFallbackPrompt(args: { mode: TaskMode; grade: number; weakest: SkillState | null; interest: string | null; date: string; studentId: string; avoidPrompts?: string[] }): { prompt: string; domain: string } {
  const { mode, grade, interest, date, studentId, avoidPrompts } = args;
  const topicSeed = interest ? extractTopicSeed(interest) : null;

  /* Fallback prompts are tagged with a domain so the refresh path can rotate
   * across domains even when OpenAI is unavailable. Order within each band:
   * we keep school-life items but they no longer dominate. */
  type FallbackEntry = { domain: string; prompt: string };
  const speakingByLevel: Record<"low" | "mid" | "high", FallbackEntry[]> = {
    low: [
      { domain: "school life", prompt: "What is one thing you enjoyed doing at school today, and why?" },
      { domain: "family & home", prompt: "Tell me about a person in your family who makes you happy and one reason why." },
      { domain: "food & cooking", prompt: "What food would you eat every day if you could? What do you like about it?" },
      { domain: "nature & animals", prompt: "Describe your favorite animal. What is it like, and what do you find interesting about it?" },
      { domain: "weather & seasons", prompt: "What is your favorite kind of weather, and what do you like to do when it is like that?" },
      { domain: "imagination & future", prompt: "If you could invent a brand-new game for your friends, what would it look like and how would you play it?" },
      { domain: "hobbies & games", prompt: "Tell me about something you like to play or make. What makes it fun?" },
      { domain: "books & stories", prompt: "What is a story or book that you keep thinking about? What part stays with you?" },
      { domain: "art & music", prompt: "If you could fill a room with one kind of art or music, what would it be and why?" }
    ],
    mid: [
      { domain: "nature & environment", prompt: "If you could spend a day in any natural place — forest, ocean, desert, mountain — which would you pick, and what would you do there?" },
      { domain: "science & discovery", prompt: "What is one thing in science or nature that you would love to understand better, and why does it pull your attention?" },
      { domain: "ethics & fairness", prompt: "When is it fair to treat people differently, and when is it not? Explain with an example." },
      { domain: "news & current events", prompt: "What is one thing happening in the world right now that you have an opinion about, and what is your opinion?" },
      { domain: "arts, books & media", prompt: "Tell me about a book, movie, or song that stuck with you. What did it make you think about?" },
      { domain: "history & culture", prompt: "If you could live for one week in any time or place in history, where and when would you choose, and why?" },
      { domain: "future & big questions", prompt: "What is one way you think life will be different ten years from now, and how do you feel about that?" },
      { domain: "hobbies & creative interests", prompt: "What is a skill you want to get better at this year, and how could you practice it?" },
      { domain: "school life", prompt: "Describe a moment at school when you felt proud of yourself. What happened, and why did it matter?" },
      { domain: "sports & health", prompt: "What is one habit that you think helps people feel better, and why?" },
      { domain: "money & responsibility", prompt: "If you were given a small amount of money to use however you wanted, what would you do with it and why?" },
      { domain: "neighborhood & community", prompt: "Describe one thing about your neighborhood that you appreciate, and one thing you would change." }
    ],
    high: [
      { domain: "philosophy & big questions", prompt: "When, if ever, is it reasonable to value comfort over truth? Explain with the limits of your own answer." },
      { domain: "ethics & moral dilemmas", prompt: "Is it more important to be kind or to be honest? Explain how you decide when they conflict." },
      { domain: "current events & news", prompt: "What is something happening in the world right now that you think deserves more attention? Make the case." },
      { domain: "science & innovation", prompt: "What scientific advance from the past 50 years do you think changed daily life the most, and what trade-off came with it?" },
      { domain: "technology's impact on society", prompt: "How has constant connectivity changed friendship — for the better, for the worse, or both? Give your view with reasons." },
      { domain: "arts, literature & media", prompt: "Tell me about a book, film, or song that genuinely changed how you see something. What changed?" },
      { domain: "history & culture", prompt: "If you could meet one person from history for thirty minutes, who would it be and what would you ask?" },
      { domain: "economics, work & money", prompt: "What does 'meaningful work' mean to you, and how might that idea change across someone's life?" },
      { domain: "personal identity & belief", prompt: "Tell me about a belief you used to hold but no longer do. What caused the change?" },
      { domain: "global issues & politics", prompt: "What is one global issue you think your generation will be judged on, and why?" },
      { domain: "human nature & psychology", prompt: "Why do you think people sometimes know what is right but still do the other thing?" },
      { domain: "environment & climate", prompt: "What is one trade-off in environmental policy that you find genuinely hard, and how would you weigh it?" },
      { domain: "school life", prompt: "If you could redesign one part of school life so it serves students better, what would it be and why?" }
    ]
  };

  const writingByLevel: Record<"low" | "mid" | "high", FallbackEntry[]> = {
    low: [
      { domain: "family & home", prompt: "Think of a place at home that feels comfortable to you. Describe what it looks like and why it feels that way." },
      { domain: "imagination & future", prompt: "Imagine a small new animal that nobody has ever seen. Describe what it looks like, where it lives, and what it eats." },
      { domain: "nature & animals", prompt: "Write about a pet you have or a pet you wish you had. Describe its personality and one memory or imagined moment with it." },
      { domain: "weather & seasons", prompt: "Describe your favorite season. What does it look like, feel like, and smell like?" },
      { domain: "food & cooking", prompt: "Tell the story of a meal you really enjoyed. Who were you with, and what made it special?" },
      { domain: "books & stories", prompt: "Write about a story or book character you remember well. Describe them and explain what makes them stick with you." },
      { domain: "art & music", prompt: "Write about a song, picture, or drawing that you like. Describe it and explain how it makes you feel." },
      { domain: "hobbies & games", prompt: "Write about something you like to make or build. Describe how you make it and why you enjoy it." },
      { domain: "school life", prompt: "Write about a small moment from school this week that you want to remember. Explain what happened and how you felt." }
    ],
    mid: [
      { domain: "nature & environment", prompt: "Describe a place in nature you have visited (or imagine visiting). What did it look, sound, and feel like, and why did it stay with you?" },
      { domain: "science & discovery", prompt: "Write a paragraph about a scientific idea or natural phenomenon you find fascinating. Why does it interest you?" },
      { domain: "ethics & fairness", prompt: "Write about a time you saw something unfair. What happened, how did you respond, and what would you do differently now?" },
      { domain: "news & current events", prompt: "Write a paragraph about a news story you have heard recently. Explain what happened and what you think about it." },
      { domain: "arts, books & media", prompt: "Pick a book, movie, or song that taught you something. Write a paragraph about what you learned and how it taught you." },
      { domain: "history & culture", prompt: "Write about a historical event or figure that interests you. Explain what they did and why it still matters." },
      { domain: "technology in daily life", prompt: "Write about one piece of technology you use every day. How does it help you, and is there a downside?" },
      { domain: "future & big questions", prompt: "Imagine yourself ten years from now. Describe one thing you hope will be true about your life, and one thing you hope will be true about the world." },
      { domain: "hobbies & creative interests", prompt: "Write a paragraph that could convince a friend to try a hobby you enjoy. Use at least two specific reasons." },
      { domain: "school life", prompt: "Think of something you used to find difficult at school but no longer do. Explain what changed for you." },
      { domain: "neighborhood & community", prompt: "Describe a problem in your neighborhood and one small action a kid your age could take to help." },
      { domain: "sports & health", prompt: "Write about an activity that makes your body or mind feel better. Describe it and explain why it works for you." }
    ],
    high: [
      { domain: "philosophy & big questions", prompt: "When, if ever, is it more responsible to revise a popular belief than to defend it? Use a specific case to argue your view, and name the limits of your answer." },
      { domain: "ethics & moral dilemmas", prompt: "Write about a real or imagined situation where doing the easy thing would be wrong. Explain how you would decide, and what would make the decision hard." },
      { domain: "current events & news", prompt: "Pick a current event you care about. Describe what is happening, why it matters, and what a reasonable response would look like." },
      { domain: "science & innovation", prompt: "Write about a scientific or technological development of the last decade that you find genuinely important. What did it change, and what did it cost?" },
      { domain: "technology's impact on society", prompt: "Some people say constant connectivity is making us less patient. Do you agree? Use examples from your own experience or what you have observed." },
      { domain: "arts, literature & media", prompt: "Write about a piece of art, literature, or film that changed how you see something. Describe the work and the shift it caused in you." },
      { domain: "history & culture", prompt: "Write about a historical decision or movement whose effects we are still living with. Explain the link in concrete terms." },
      { domain: "economics, work & money", prompt: "What does 'meaningful work' mean to you, and how might that definition evolve over a person's life?" },
      { domain: "personal identity & belief", prompt: "Write about a belief you used to hold but no longer do. What changed your mind, and what does the change teach you about how you reason?" },
      { domain: "global issues & politics", prompt: "Argue for or against a specific policy you care about. Use at least one counter-argument and respond to it." },
      { domain: "environment & climate", prompt: "Write about a climate or environmental trade-off you find genuinely difficult. Make your case and acknowledge what makes the opposite view reasonable." },
      { domain: "human nature & psychology", prompt: "Write about why people sometimes know what is right but still do the other thing. Use a real or imagined example to anchor the argument." },
      { domain: "education & learning itself", prompt: "Write a short opinion piece: 'The most important thing school can teach is ___.' Defend your choice with at least two reasons." }
    ]
  };

  const band = grade <= 3 ? "low" : grade <= 6 ? "mid" : "high";
  const pool = mode === "speaking" ? speakingByLevel[band] : writingByLevel[band];

  const avoidSet = new Set((avoidPrompts ?? []).map((p) => p.trim()));

  // Step 1: drop any prompt the student already saw today (exact match).
  const notSeen = pool.filter((entry) => !avoidSet.has(entry.prompt));

  // Step 2: figure out which domains we've already used today and prefer
  // entries from a DIFFERENT domain so the fallback also rotates subjects
  // (the whole reason 다른 주제 받기 felt broken).
  const usedDomains = new Set<string>();
  for (const entry of pool) {
    if (avoidSet.has(entry.prompt)) usedDomains.add(entry.domain);
  }
  const fromNewDomain = notSeen.filter((entry) => !usedDomains.has(entry.domain));
  const candidates = fromNewDomain.length > 0 ? fromNewDomain : notSeen.length > 0 ? notSeen : pool;

  // Stable hash so the very first prompt of the day is deterministic, but
  // mixing in avoidSet.size guarantees each refresh picks a different slot.
  const seedString = `${studentId}-${mode}-${date}-${topicSeed ?? args.weakest?.skill ?? "general"}-r${avoidSet.size}`;
  const seedHash = hashString(seedString);
  const chosen = candidates[seedHash % candidates.length];
  return { prompt: chosen.prompt, domain: chosen.domain };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function extractTopicSeed(claim: string): string | null {
  const match = claim.match(/[가-힣A-Za-z ,]+/);
  if (!match) return null;
  const cleaned = match[0].trim();
  return cleaned.length > 0 ? cleaned.split(/[,.]/)[0].trim() : null;
}

function buildFallbackReason(args: { student: Student; weakest: SkillState | null }) {
  const { student, weakest } = args;
  const meta = gradeMetaFromLabel(student.usGradeLevel);
  if (weakest) {
    return `${student.displayName} 학생의 ${weakest.skill} 점수가 ${weakest.score}점이라 ${meta.stageLabel}(CEFR ${meta.cefrEquivalent}) 기준으로 해당 영역을 강화하는 과제로 선택했습니다.`;
  }
  return `${student.displayName} 학생의 ${meta.stageLabel}(CEFR ${meta.cefrEquivalent})에 맞춘 일일 과제입니다.`;
}
