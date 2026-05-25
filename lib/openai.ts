import { demoStudents } from "@/lib/demo-data";
import type { StudentContext } from "@/lib/task-generator";
import type {
  EvaluationSnapshot,
  LearningEventResponse,
  LearningEventRequest,
  Observation,
  ReferenceSentence,
  SkillState,
  SpeakingAttempt,
  SpeakingAttemptResponse,
  WritingEvaluationDetails,
  WritingRevisionComparison
} from "@/lib/types";

export type StudentDevelopmentInput = {
  displayName: string;
  cefrLevel: string;
  usGradeLevel: string;
  observations: Observation[];
  skillStates: SkillState[];
  recentSnapshots: EvaluationSnapshot[];
  recentSpeakingAttempts: SpeakingAttempt[];
};

type EvaluationInput = LearningEventRequest & {
  studentContext?: StudentContext;
};

type SpeakingEvaluationInput = {
  topic: string;
  transcript: string;
  attemptNumber: number;
  previousScore?: number;
};

function evaluationModel() {
  return process.env.OPENAI_EVALUATION_MODEL ?? "gpt-5.4-mini";
}

export async function evaluateLearningEvent(input: EvaluationInput): Promise<LearningEventResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackEvaluation(input);
  }

  const isWriting = input.mode === "writing";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: evaluationModel(),
      instructions:
        (isWriting
          ? "You are an exceptional English writing teacher for a school-age child. Return only valid JSON matching the requested shape. Use the provided student_context (CEFR level, US grade equivalent, skill states, recent observations) to calibrate the rigor of your feedback and the difficulty of the suggested next task. Give specific Korean feedback on structure, logic, sentence quality, grammar, vocabulary, expression, and coherence. Provide sentence-level corrections grounded in what the child actually wrote. If this is a revision, compare it with the previous draft and explain exactly what improved and what still needs work. The suggested nextTask must build on the student's current skill states and observed gaps, not generic prompts."
          : "You are a warm but rigorous English tutor for a school-age child. Return only valid JSON matching the requested shape. Use the provided student_context (CEFR level, US grade equivalent, skill states, recent observations) to calibrate the next task and feedback. Keep Korean parent notes concise and child feedback encouraging but specific. The suggested nextTask must build on the student's current skill states and observed gaps, not generic prompts.") +
        " SCORING RULE: Calibrate scores so that an on-level, age-appropriate answer scores around 70/100. Reserve 80+ for clearly strong answers (well-structured, accurate, with elaborated reasoning), and 60- for answers that miss the task or have many basic errors. Individual rubric metrics should also average close to the overall score (within ±5 of it).",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task_mode: input.mode,
                child_answer: input.answer,
                is_revision: Boolean(input.isRevision),
                previous_answer: input.previousAnswer,
                previous_score: input.previousScore,
                student_context: input.studentContext
                  ? {
                      displayName: input.studentContext.student.displayName,
                      cefrLevel: input.studentContext.student.cefrLevel,
                      usGradeLevel: input.studentContext.student.usGradeLevel,
                      levelDescription: input.studentContext.student.levelDescription,
                      skillStates: input.studentContext.skillStates.map((s) => ({
                        skill: s.skill,
                        level: s.level,
                        score: s.score,
                        signals: s.signals,
                        nextTargets: s.nextTargets
                      })),
                      recentObservations: input.studentContext.recentObservations.map((o) => ({
                        type: o.type,
                        skill: o.skill,
                        claim: o.claim,
                        confidence: o.confidence,
                        lastSeen: o.lastSeen
                      }))
                    }
                  : undefined,
                requested_shape: {
                  feedbackForChild: "Korean sentence, max 2 sentences",
                  parentNote: "Korean sentence, max 2 sentences",
                  evaluation: {
                    overallScore: 0,
                    metrics:
                      input.mode === "writing"
                        ? [
                            { label: "Structure", score: 0 },
                            { label: "Logic", score: 0 },
                            { label: "Sentence craft", score: 0 },
                            { label: "Grammar", score: 0 },
                            { label: "Expression", score: 0 }
                          ]
                        : [
                            { label: "Fluency", score: 0 },
                            { label: "Response length", score: 0 },
                            { label: "Interaction", score: 0 },
                            { label: "Accuracy", score: 0 }
                          ],
                    strengths: ["Korean qualitative strength"],
                    needsPractice: ["Korean qualitative next step"]
                  },
                  observations: [
                    {
                      type: "skill_pattern | growth_signal | interest",
                      skill: "snake_case skill name",
                      claim: "Korean evidence-backed observation",
                      confidence: 0.0
                    }
                  ],
                  skillStates: [
                    {
                      skill: "snake_case skill name",
                      level: "new | emerging | growing | strong",
                      score: 0,
                      signals: ["Korean signal"],
                      nextTargets: ["Korean next target"]
                    }
                  ],
                  nextTask: {
                    prompt: "English task prompt for next session",
                    mode: "speaking | writing",
                    targetSkills: ["snake_case"],
                    generatedReason: "Korean reason",
                    successCriteria: ["Korean success criterion"]
                  },
                  writingFeedback: isWriting
                    ? {
                        submittedText: "Original student writing",
                        revisedText:
                          "A polished but age-appropriate revised version of the full answer, preserving the student's ideas",
                        rubricSections: [
                          { title: "구조", score: 0, notes: ["Korean feedback"] },
                          { title: "논리", score: 0, notes: ["Korean feedback"] },
                          { title: "문장력", score: 0, notes: ["Korean feedback"] },
                          { title: "문법", score: 0, notes: ["Korean feedback"] },
                          { title: "표현력", score: 0, notes: ["Korean feedback"] }
                        ],
                        sentencePractices: [
                          {
                            original: "Exact or close phrase from the student's writing",
                            improved:
                              "Excellent corrected sentence preserving the student's meaning and appropriate for the child's level",
                            focus: "Short Korean/English focus"
                          }
                        ],
                        revisionPlan: [
                          "Korean action step for rewriting",
                          "Korean action step for rewriting"
                        ]
                      }
                    : undefined,
                  revisionComparison: isWriting && input.isRevision
                    ? {
                        previousScore: input.previousScore ?? 0,
                        currentScore: 0,
                        scoreDelta: 0,
                        improvements: [
                          "Korean comparison: what improved from the previous draft"
                        ],
                        remainingTargets: [
                          "Korean comparison: what still needs work"
                        ]
                      }
                    : undefined
                }
              })
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    return fallbackEvaluation(input);
  }

  const json = await response.json();
  const text = extractOutputText(json);

  try {
    const parsed = JSON.parse(text);
    return normalizeEvaluation(parsed, input);
  } catch {
    return fallbackEvaluation(input);
  }
}

export async function evaluateSpeakingAttempt(input: {
  audio: File | null;
  studentId: string;
  taskId: string;
  topic: string;
  attemptNumber: number;
  previousScore?: number;
}): Promise<SpeakingAttemptResponse> {
  const transcript = input.audio ? await transcribeAudio(input.audio, input.topic) : fallbackTranscript(input.topic);
  const result = process.env.OPENAI_API_KEY
    ? await evaluateSpeakingTranscript({
        ...input,
        transcript
      })
    : fallbackSpeakingEvaluation({
        ...input,
        transcript
      });

  return result;
}

async function transcribeAudio(audio: File, topic: string) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackTranscript(topic);
  }

  const formData = new FormData();
  formData.set("model", process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe");
  formData.set("file", audio);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    return fallbackTranscript(topic);
  }

  const payload = await response.json();
  return String(payload.text ?? "").trim() || fallbackTranscript(topic);
}

async function evaluateSpeakingTranscript(input: SpeakingEvaluationInput): Promise<SpeakingAttemptResponse> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: evaluationModel(),
      instructions:
        "You are an English speaking coach for a child. Return only valid JSON. Evaluate kindly but rigorously. Provide Korean feedback for parent/child. Reference sentences must be improved versions of what the child actually tried to say, anchored to the given topic and transcript. Preserve the child's intended meaning, do not introduce unrelated content, and do not treat reference sentences as standalone repeat-after-me tests. The child will use them to re-record the full answer. SCORING RULE: Calibrate so an on-level, age-appropriate spoken answer scores around 70/100. Reserve 80+ for clearly strong takes (fluent, accurate, with developed reasoning); 60- for answers that miss the topic or have many basic errors. Individual rubric metrics should also average close to the overall score (within ±5).",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                topic: input.topic,
                transcript: input.transcript,
                attempt_number: input.attemptNumber,
                previous_score: input.previousScore,
                reference_sentence_rules: [
                  "Base every improved sentence on the transcript and topic.",
                  "Keep the same topic, opinion, place, event, or example the child mentioned.",
                  "Improve grammar, structure, vocabulary, and clarity.",
                  "Make the sentences usable inside the next full-answer recording, not as isolated practice lines."
                ],
                requested_shape: {
                  score: 0,
                  metrics: [
                    { label: "Fluency", score: 0 },
                    { label: "Pronunciation", score: 0 },
                    { label: "Response length", score: 0 },
                    { label: "Accuracy", score: 0 }
                  ],
                  feedbackSections: [
                    { title: "전체 구조", notes: ["Korean feedback"] },
                    { title: "문장", notes: ["Korean feedback"] },
                    { title: "단어", notes: ["Korean feedback"] },
                    { title: "발음/유창성", notes: ["Korean feedback"] }
                  ],
                  referenceSentences: [
                    {
                      original: "Exact or close child phrase from transcript when useful",
                      improved: "Improved English sentence based on the child's meaning",
                      focus: "Short Korean/English focus for using it in the full answer"
                    }
                  ],
                  memoryNotes: ["Korean durable learning memory"],
                  observations: [
                    {
                      type: "mistake | improvement | strategy | interest",
                      claim: "Korean memory claim",
                      evidence: "Transcript evidence"
                    }
                  ]
                }
              })
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    return fallbackSpeakingEvaluation(input);
  }

  const payload = await response.json();
  const text = extractOutputText(payload);

  try {
    return normalizeSpeakingEvaluation(JSON.parse(text), input);
  } catch {
    return fallbackSpeakingEvaluation(input);
  }
}

function normalizeSpeakingEvaluation(
  parsed: any,
  input: SpeakingEvaluationInput
): SpeakingAttemptResponse {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const score = Number(parsed.score ?? 70);
  const referenceSentences = normalizeReferenceSentences(parsed.referenceSentences, input);
  const memoryClaims = Array.isArray(parsed.memoryNotes) ? parsed.memoryNotes : ["오늘 녹음 시도와 교정 포인트를 저장했습니다."];

  const attempt: SpeakingAttempt = {
    id: `speaking-attempt-${Date.now()}`,
    date,
    topic: input.topic,
    transcript: input.transcript,
    score,
    metrics: parsed.metrics ?? defaultSpeakingMetrics(score),
    feedbackSections: parsed.feedbackSections ?? fallbackSpeakingSections(input),
    referenceSentences,
    memoryNotes: memoryClaims
  };

  return {
    attempt,
    evaluationSnapshot: {
      id: `speaking-evaluation-${Date.now()}`,
      date: date.slice(5).replace("-", "/"),
      mode: "speaking",
      overallScore: score,
      metrics: attempt.metrics,
      strengths: attempt.feedbackSections[0]?.notes ?? ["녹음을 완료했습니다."],
      needsPractice: attempt.feedbackSections.slice(1).flatMap((section) => section.notes).slice(0, 3)
    },
    observations: (parsed.observations ?? []).slice(0, 4).map((item: any, index: number) => ({
      id: `speaking-observation-${Date.now()}-${index}`,
      type: item.type ?? "mistake",
      skill: "speaking",
      claim: item.claim ?? String(memoryClaims[index] ?? "스피킹 시도 기록이 추가되었습니다."),
      confidence: 0.72,
      lastSeen: date
    })),
    nextReferenceSentences: referenceSentences,
    memoryNotes: memoryClaims.map((claim: string, index: number) => ({
      id: `speaking-memory-${Date.now()}-${index}`,
      date,
      type: claim.includes("좋") || claim.includes("늘") ? "improvement" : "mistake",
      claim,
      evidence: input.transcript
    }))
  };
}

function fallbackSpeakingEvaluation(input: SpeakingEvaluationInput): SpeakingAttemptResponse {
  // Center fallback scores on 70 (the new average baseline). Revisions move up a
  // little; first attempts sit right at the mean.
  const base = input.previousScore ? Math.min(95, Math.max(60, input.previousScore + 4)) : 70;
  return normalizeSpeakingEvaluation(
    {
      score: base,
      metrics: defaultSpeakingMetrics(base),
      feedbackSections: fallbackSpeakingSections(input),
      referenceSentences: fallbackReferenceSentences(input),
      memoryNotes: [
        "오늘 말한 내용을 더 정확한 문장 구조로 다시 구성하는 연습이 필요합니다.",
        "전체 답변을 다시 녹음하면서 이유와 예시가 늘어나는지 추적합니다."
      ],
      observations: [
        {
          type: "mistake",
          claim: "학생 발화를 바탕으로 문법과 문장 순서를 보완할 필요가 있습니다.",
          evidence: input.transcript
        },
        {
          type: "strategy",
          claim: "개선 문장을 참고해 같은 주제의 전체 답변을 다시 녹음하면 점수 변화를 볼 수 있습니다.",
          evidence: input.topic
        }
      ]
    },
    input
  );
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

function fallbackTranscript(topic: string) {
  const normalizedTopic = topic.toLowerCase();

  if (normalizedTopic.includes("phone") || normalizedTopic.includes("lunch")) {
    return "I think students should use phones at lunch because they can text parents and relax with friends.";
  }

  if (normalizedTopic.includes("field trip") || normalizedTopic.includes("trip")) {
    return "I want to go to a science museum. We will see experiments and robots. It will be fun because we can learn with friends.";
  }

  return "I think this is a good idea because it is interesting and I can explain my reasons.";
}

function defaultSpeakingMetrics(score: number) {
  // Centered around the overall score (average ≈ score).
  return [
    { label: "Fluency", score: clamp(score - 2) },
    { label: "Pronunciation", score: clamp(score + 1) },
    { label: "Response length", score: clamp(score - 1) },
    { label: "Accuracy", score: clamp(score + 2) }
  ];
}

function fallbackSpeakingSections(input: Pick<SpeakingEvaluationInput, "topic" | "transcript">) {
  const context = `${input.topic} ${input.transcript}`.toLowerCase();

  if (context.includes("phone") || context.includes("lunch")) {
    return [
      {
        title: "전체 구조",
        notes: ["의견을 먼저 말하고, because로 이유를 두 개 붙이면 답변이 더 설득력 있어집니다."]
      },
      {
        title: "문장",
        notes: ["I think students should...처럼 주장 문장으로 시작하면 더 명확합니다."]
      },
      {
        title: "단어",
        notes: ["phone, lunch, parents, relax처럼 주제와 직접 연결되는 단어를 사용하세요."]
      },
      {
        title: "발음/유창성",
        notes: ["의견, 이유 1, 이유 2, 예시를 한 박자씩 나누어 말한 뒤 자연스럽게 이어보세요."]
      }
    ];
  }

  if (context.includes("field trip") || context.includes("trip") || context.includes("museum")) {
    return [
      {
        title: "전체 구조",
        notes: ["어디에 갈지, 무엇을 볼지, 왜 재미있는지 순서대로 말하면 답변이 더 잘 들립니다."]
      },
      {
        title: "문장",
        notes: ["We will see...와 It would be fun because...를 사용하면 계획과 이유가 자연스럽게 이어집니다."]
      },
      {
        title: "단어",
        notes: ["science museum, experiments, robot show처럼 장소와 활동을 구체적으로 말해보세요."]
      },
      {
        title: "발음/유창성",
        notes: ["각 문장을 너무 급하게 말하지 말고 핵심 단어 뒤에서 짧게 쉬어보세요."]
      }
    ];
  }

  return [
    {
      title: "전체 구조",
      notes: ["주제에 맞게 시작했습니다. 주장, 이유, 예시 순서로 한 번 더 정리해보세요."]
    },
    {
      title: "문장",
      notes: ["짧은 문장을 because, so, for example로 연결하면 답변이 더 자연스럽습니다."]
    },
    {
      title: "단어",
      notes: ["학생이 말한 핵심 단어를 더 구체적인 명사와 형용사로 바꿔보세요."]
    },
    {
      title: "발음/유창성",
      notes: ["전체 답변을 다시 녹음하면서 문장 사이를 조금 더 부드럽게 이어보세요."]
    }
  ];
}

function fallbackReferenceSentences(input: Pick<SpeakingEvaluationInput, "topic" | "transcript">): ReferenceSentence[] {
  const context = `${input.topic} ${input.transcript}`.toLowerCase();

  if (context.includes("phone") || context.includes("lunch")) {
    return [
      {
        original: input.transcript,
        improved: "I think students should be allowed to use phones during lunch because they can relax and contact their parents.",
        focus: "opinion + two clear reasons"
      },
      {
        improved: "For example, a student might need to text a parent about an after-school plan.",
        focus: "add a school-life example"
      }
    ];
  }

  if (context.includes("field trip") || context.includes("trip") || context.includes("museum")) {
    return [
      {
        original: input.transcript,
        improved: "I think our class should go to a science museum for our field trip.",
        focus: "say the place clearly"
      },
      {
        improved: "We can see interesting experiments and learn how robots work.",
        focus: "add what you will see"
      },
      {
        improved: "It would be fun because we could learn new things with our friends.",
        focus: "explain why it would be fun"
      }
    ];
  }

  return [
    {
      original: input.transcript,
      improved: "I think this is a good idea because I can explain my reasons clearly.",
      focus: "opinion + because"
    },
    {
      improved: "For example, I can give one detail from my own experience.",
      focus: "add one example"
    }
  ];
}

function normalizeReferenceSentences(
  input: any,
  context: Pick<SpeakingEvaluationInput, "topic" | "transcript">
): ReferenceSentence[] {
  if (!Array.isArray(input) || input.length === 0) {
    return fallbackReferenceSentences(context);
  }

  const sentences = input
    .slice(0, 4)
    .map((item) => ({
      original: typeof item.original === "string" && item.original.trim().length > 0 ? item.original : context.transcript,
      improved: item.improved,
      focus: item.focus ?? "use this in the full answer"
    }))
    .filter(
      (item) =>
        typeof item.improved === "string" &&
        item.improved.trim().length > 0 &&
        isReferenceOnTopic(item.improved, context)
    );

  return sentences.length ? sentences : fallbackReferenceSentences(context);
}

function isReferenceOnTopic(sentence: string, context: Pick<SpeakingEvaluationInput, "topic" | "transcript">) {
  const topicContext = `${context.topic} ${context.transcript}`.toLowerCase();
  const normalizedSentence = sentence.toLowerCase();

  if (topicContext.includes("phone") || topicContext.includes("lunch")) {
    return /\b(phone|phones|lunch|student|students|parent|parents|friend|friends|school)\b/.test(normalizedSentence);
  }

  if (topicContext.includes("field trip") || topicContext.includes("trip") || topicContext.includes("museum")) {
    return /\b(field trip|trip|museum|experiment|experiments|robot|robots|class|learn|friends|place)\b/.test(
      normalizedSentence
    );
  }

  return true;
}

function normalizeEvaluation(parsed: any, input: EvaluationInput): LearningEventResponse {
  const today = new Date().toISOString();
  const fallbackTask = demoStudents[0].todayTask;
  const score = Number(parsed.evaluation?.overallScore ?? 70);
  const writingFeedback =
    input.mode === "writing" ? normalizeWritingFeedback(parsed.writingFeedback, input.answer, score) : undefined;
  const revisionComparison =
    input.mode === "writing" && input.isRevision
      ? normalizeRevisionComparison(parsed.revisionComparison, input, score)
      : undefined;

  return {
    feedbackForChild:
      parsed.feedbackForChild ?? "좋아요. 오늘 답변에서 의미를 전달하려는 힘이 보였습니다.",
    parentNote:
      parsed.parentNote ?? "오늘 학습은 완료되었습니다. 다음에는 이유 설명을 조금 더 늘려보면 좋겠습니다.",
    evaluationSnapshot: {
      id: `generated-evaluation-${Date.now()}`,
      date: today.slice(5, 10).replace("-", "/"),
      mode: input.mode,
      overallScore: score,
      metrics: parsed.evaluation?.metrics ?? defaultMetrics(input.mode, score),
      strengths: parsed.evaluation?.strengths ?? ["오늘 답변을 끝까지 완성했습니다."],
      needsPractice: parsed.evaluation?.needsPractice ?? ["다음에는 이유를 하나 더 붙여봅니다."]
    },
    writingFeedback,
    revisionComparison,
    observations: (parsed.observations ?? []).slice(0, 4).map((item: any, index: number) => ({
      id: `generated-observation-${Date.now()}-${index}`,
      type: item.type ?? "skill_pattern",
      skill: item.skill ?? "sentence_expansion",
      claim: item.claim ?? "답변을 문장으로 확장하는 연습이 필요합니다.",
      confidence: Number(item.confidence ?? 0.65),
      lastSeen: today.slice(0, 10)
    })),
    skillStates: (parsed.skillStates ?? []).slice(0, 4).map((item: any, index: number) => ({
      id: `generated-skill-${Date.now()}-${index}`,
      skill: item.skill ?? "sentence_expansion",
      level: item.level ?? "emerging",
      score: Number(item.score ?? 50),
      signals: item.signals ?? ["오늘 태스크를 완료했습니다."],
      nextTargets: item.nextTargets ?? ["답변에 이유를 하나 더 추가하기"]
    })),
    nextTask: {
      id: `generated-task-${Date.now()}`,
      mode: parsed.nextTask?.mode ?? "speaking",
      prompt: parsed.nextTask?.prompt ?? fallbackTask.prompt,
      targetSkills: parsed.nextTask?.targetSkills ?? ["reason_giving"],
      rewardValue: 1,
      generatedReason: parsed.nextTask?.generatedReason ?? "오늘 답변을 바탕으로 이유 설명을 이어갑니다.",
      successCriteria: parsed.nextTask?.successCriteria ?? ["4문장 이상 말하기"]
    }
  };
}

function fallbackEvaluation(input: EvaluationInput): LearningEventResponse {
  const today = new Date().toISOString();
  const fallbackStudent = demoStudents[0];
  const score = 70;
  const revisionScore = input.isRevision ? Math.max(score, Math.min(95, Number(input.previousScore ?? score) + 6)) : score;

  return {
    feedbackForChild:
      input.mode === "writing"
        ? "좋아요. 이제 문장별로 더 정확하고 설득력 있는 표현으로 고쳐서 다시 써볼 차례예요."
        : "오늘 태스크 완료! 답변을 더 길게 만들기 위해 because 뒤에 이유를 하나 더 붙여보면 좋아요.",
    parentNote:
      input.mode === "writing"
        ? "OpenAI 키가 없어서 데모 첨삭을 사용했습니다. 실제 평가에서는 구조, 논리, 문장력, 문법, 표현력별 첨삭이 생성됩니다."
        : "OpenAI 키가 없어서 데모 평가를 사용했습니다. 실제 배포에서는 답변별 관찰과 다음 과제가 자동 생성됩니다.",
    evaluationSnapshot: {
      id: `demo-evaluation-${Date.now()}`,
      date: today.slice(5, 10).replace("-", "/"),
      mode: input.mode,
      overallScore: revisionScore,
      metrics: defaultMetrics(input.mode, revisionScore),
      strengths:
        input.mode === "writing"
          ? ["아이디어를 끝까지 글로 남겼습니다.", "because를 써볼 준비가 되어 있습니다."]
          : ["대화 주제에 맞게 반응했습니다.", "짧은 문장을 이어갈 수 있습니다."],
      needsPractice:
        input.mode === "writing"
          ? ["문장 순서를 더 자연스럽게 연결하기", "같은 단어 반복 줄이기"]
          : ["답변 길이를 두 문장 이상으로 늘리기", "과거형 동사 안정화"]
    },
    writingFeedback: input.mode === "writing" ? fallbackWritingFeedback(input.answer, revisionScore) : undefined,
    revisionComparison:
      input.mode === "writing" && input.isRevision ? fallbackRevisionComparison(input, revisionScore) : undefined,
    observations: [
      {
        id: `demo-observation-${Date.now()}`,
        type: "growth_signal",
        skill: input.mode === "writing" ? "sentence_complexity" : "reason_giving",
        claim: "오늘 태스크를 끝까지 완료했고, 이유를 설명하는 연습을 이어갈 준비가 되어 있습니다.",
        confidence: 0.66,
        lastSeen: today.slice(0, 10)
      }
    ],
    skillStates: fallbackStudent.skillStates,
    nextTask: {
      ...fallbackStudent.todayTask,
      id: `demo-next-task-${Date.now()}`
    }
  };
}

function normalizeRevisionComparison(
  input: any,
  context: Pick<EvaluationInput, "previousScore" | "previousAnswer" | "answer">,
  currentScore: number
): WritingRevisionComparison {
  const fallback = fallbackRevisionComparison(context, currentScore);
  const previousScore = Number(input?.previousScore ?? context.previousScore ?? fallback.previousScore);
  const normalizedPreviousScore = Number.isFinite(previousScore) ? previousScore : fallback.previousScore;
  const normalizedCurrentScore = clampScore(input?.currentScore, currentScore);
  const scoreDelta = Number(input?.scoreDelta ?? normalizedCurrentScore - normalizedPreviousScore);
  const improvements = normalizeStringList(input?.improvements);
  const remainingTargets = normalizeStringList(input?.remainingTargets);

  return {
    previousScore: normalizedPreviousScore,
    currentScore: normalizedCurrentScore,
    scoreDelta: Number.isFinite(scoreDelta) ? Math.round(scoreDelta) : normalizedCurrentScore - normalizedPreviousScore,
    improvements: improvements.length ? improvements.slice(0, 4) : fallback.improvements,
    remainingTargets: remainingTargets.length ? remainingTargets.slice(0, 4) : fallback.remainingTargets
  };
}

function fallbackRevisionComparison(
  input: Pick<EvaluationInput, "previousScore" | "previousAnswer" | "answer">,
  currentScore: number
): WritingRevisionComparison {
  const previousScore = Number(input.previousScore ?? Math.max(0, currentScore - 6));
  const normalizedPreviousScore = Number.isFinite(previousScore) ? previousScore : Math.max(0, currentScore - 6);

  return {
    previousScore: normalizedPreviousScore,
    currentScore,
    scoreDelta: currentScore - normalizedPreviousScore,
    improvements: [
      "이전 글보다 주장과 이유가 더 분명하게 연결되었습니다.",
      "문장 practice에서 익힌 표현을 사용해 문장 흐름이 더 자연스러워졌습니다."
    ],
    remainingTargets: [
      "다음 재작성에서는 예시를 한 문장 더 구체적으로 붙이면 좋습니다.",
      "마지막 결론 문장에서 같은 단어 반복을 줄여보세요."
    ]
  };
}

function normalizeWritingFeedback(input: any, submittedText: string, score: number): WritingEvaluationDetails {
  const fallback = fallbackWritingFeedback(submittedText, score);
  const rubricInput = Array.isArray(input?.rubricSections) ? input.rubricSections : [];
  const practiceInput = Array.isArray(input?.sentencePractices) ? input.sentencePractices : [];
  const revisionPlanInput = Array.isArray(input?.revisionPlan) ? input.revisionPlan : [];

  const rubricSections = rubricInput
    .slice(0, 6)
    .map((section: any) => ({
      title: String(section.title ?? "").trim(),
      score: clampScore(section.score, score),
      notes: normalizeStringList(section.notes)
    }))
    .filter((section: any) => section.title && section.notes.length);

  const sentencePractices = practiceInput
    .slice(0, 5)
    .map((sentence: any) => ({
      original:
        typeof sentence.original === "string" && sentence.original.trim().length > 0
          ? sentence.original.trim()
          : submittedText,
      improved: typeof sentence.improved === "string" ? sentence.improved.trim() : "",
      focus: typeof sentence.focus === "string" && sentence.focus.trim().length > 0 ? sentence.focus.trim() : "stronger sentence"
    }))
    .filter((sentence: ReferenceSentence) => sentence.improved.length > 0);

  const revisedText =
    typeof input?.revisedText === "string" && input.revisedText.trim().length > 0
      ? input.revisedText.trim()
      : fallback.revisedText;

  return {
    submittedText:
      typeof input?.submittedText === "string" && input.submittedText.trim().length > 0
        ? input.submittedText.trim()
        : submittedText,
    revisedText,
    rubricSections: rubricSections.length ? rubricSections : fallback.rubricSections,
    sentencePractices: sentencePractices.length ? sentencePractices : fallback.sentencePractices,
    revisionPlan: revisionPlanInput.length ? normalizeStringList(revisionPlanInput).slice(0, 4) : fallback.revisionPlan
  };
}

function fallbackWritingFeedback(submittedText: string, score: number): WritingEvaluationDetails {
  const baseText = submittedText.trim() || "I think the zoo is a good place because students can see animals.";
  return {
    submittedText: baseText,
    revisedText:
      "I think our class should go to the zoo because it would be both fun and educational. First, we could observe many animals closely and learn how they live. Second, we could spend meaningful time with our friends while practicing what we learned in class. For these reasons, the zoo would be a great place for our next trip.",
    rubricSections: [
      {
        title: "구조",
        score,
        notes: ["의견과 이유가 보입니다. 처음에는 주장, 중간에는 이유 2개, 마지막에는 결론이 오도록 단락을 정리하세요."]
      },
      {
        title: "논리",
        score: Math.max(0, score - 4),
        notes: ["동물원에 가야 하는 이유가 더 구체적인 예시와 연결되면 설득력이 올라갑니다."]
      },
      {
        title: "문장력",
        score: Math.max(0, score - 2),
        notes: ["First, Second, For these reasons 같은 연결어를 쓰면 글이 더 성숙하게 읽힙니다."]
      },
      {
        title: "문법",
        score: Math.max(0, score - 8),
        notes: ["명사 앞의 관사, 복수형, because 뒤의 완전한 문장을 확인하세요."]
      },
      {
        title: "표현력",
        score: Math.min(100, score + 2),
        notes: ["fun만 반복하지 말고 educational, meaningful, observe 같은 단어로 표현을 넓혀보세요."]
      }
    ],
    sentencePractices: [
      {
        original: baseText,
        improved: "I think our class should go to the zoo because it would be both fun and educational.",
        focus: "clear opinion + stronger reason"
      },
      {
        improved: "We could observe many animals closely and learn how they live.",
        focus: "specific action + learning"
      },
      {
        improved: "For these reasons, the zoo would be a great place for our next trip.",
        focus: "clear closing sentence"
      }
    ],
    revisionPlan: [
      "첫 문장에 내 의견을 분명히 씁니다.",
      "First와 Second로 이유를 두 개 나눕니다.",
      "마지막 문장은 For these reasons로 결론을 정리합니다."
    ]
  };
}

function normalizeStringList(input: any): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((item) => String(item).trim()).filter(Boolean);
}

function clampScore(input: any, fallback: number) {
  const score = Number(input);
  if (!Number.isFinite(score)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function summarizeStudentDevelopment(input: StudentDevelopmentInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackDevelopmentSummary(input);
  }

  const compactSnapshots = input.recentSnapshots.slice(-6).map((snapshot) => ({
    date: snapshot.date,
    mode: snapshot.mode,
    overall: snapshot.overallScore,
    strengths: snapshot.strengths,
    needs: snapshot.needsPractice
  }));

  const compactAttempts = input.recentSpeakingAttempts.slice(0, 6).map((attempt) => ({
    date: attempt.date,
    topic: attempt.topic,
    score: attempt.score
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: evaluationModel(),
      instructions:
        "You write a single Korean paragraph (3–5 sentences, no bullet points, no headings) summarizing how a school-age English learner is developing. Be concrete — name skills that improved and where the child still struggles. Use a warm, factual tone aimed at a parent. Output only the paragraph text.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                student: {
                  name: input.displayName,
                  cefr: input.cefrLevel,
                  grade: input.usGradeLevel
                },
                observations: input.observations.map((entry) => ({
                  skill: entry.skill,
                  claim: entry.claim,
                  confidence: entry.confidence,
                  last_seen: entry.lastSeen
                })),
                skill_states: input.skillStates.map((entry) => ({
                  skill: entry.skill,
                  level: entry.level,
                  score: entry.score,
                  signals: entry.signals
                })),
                recent_snapshots: compactSnapshots,
                recent_speaking_attempts: compactAttempts
              })
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    return fallbackDevelopmentSummary(input);
  }

  const payload = await response.json();
  const text = extractOutputText(payload).trim();
  return text.length > 0 ? text : fallbackDevelopmentSummary(input);
}

function fallbackDevelopmentSummary(input: StudentDevelopmentInput): string {
  const latest = input.recentSnapshots.at(-1);
  const strongest = [...input.skillStates].sort((a, b) => b.score - a.score)[0];
  const weakest = [...input.skillStates].sort((a, b) => a.score - b.score)[0];

  const pieces: string[] = [];
  pieces.push(
    `${input.displayName} 학생은 최근 ${input.recentSnapshots.length}번의 평가에서 꾸준히 학습을 이어가고 있습니다.`
  );

  if (latest) {
    pieces.push(
      `가장 최근 ${latest.mode === "speaking" ? "Speaking" : "Writing"} 평가에서는 ${latest.overallScore}점을 기록했고, ${latest.strengths[0] ?? "참여도가 안정적"}이라는 점이 인상적입니다.`
    );
  }

  if (strongest) {
    pieces.push(`현재 가장 안정된 영역은 ${strongest.skill}(${strongest.score}/100)입니다.`);
  }

  if (weakest && weakest.skill !== strongest?.skill) {
    pieces.push(`반면 ${weakest.skill}는 아직 ${weakest.score}/100로, 짧은 일상 표현부터 반복 연습이 필요합니다.`);
  }

  if (input.observations[0]) {
    pieces.push(`최근 관찰: ${input.observations[0].claim}`);
  }

  return pieces.join(" ");
}

function defaultMetrics(mode: "speaking" | "writing", score: number) {
  // Centered around the overall score so the average across metrics matches it.
  // Spread is ±3 for typical performances, keeping metrics balanced near 70.
  if (mode === "writing") {
    return [
      { label: "Structure", score: clamp(score - 2) },
      { label: "Logic", score: clamp(score - 1) },
      { label: "Sentence craft", score: clamp(score + 2) },
      { label: "Grammar", score: clamp(score - 3) },
      { label: "Expression", score: clamp(score + 4) }
    ];
  }

  return [
    { label: "Fluency", score: clamp(score - 3) },
    { label: "Response length", score: clamp(score + 1) },
    { label: "Interaction", score: clamp(score + 4) },
    { label: "Accuracy", score: clamp(score - 2) }
  ];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
