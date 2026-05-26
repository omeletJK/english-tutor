import type {
  DashboardData,
  EvaluationSnapshot,
  FamilyRole,
  FamilyUser,
  MemoryNote,
  RewardRule,
  SpeakingAttempt,
  StudentDashboard
} from "@/lib/types";

export const defaultFamilyEmails = {
  jiyool: process.env.JIYOOL_EMAIL ?? "jiyool@example.com",
  hayool: process.env.HAYOOL_EMAIL ?? "hayool@example.com",
  parent: process.env.PARENT_EMAIL ?? "parent@example.com"
};

const jiyoolEvaluations: EvaluationSnapshot[] = [
  {
    id: "j-eval-1",
    date: "5/18",
    mode: "speaking",
    overallScore: 62,
    metrics: [
      { label: "Fluency", score: 52 },
      { label: "Response length", score: 58 },
      { label: "Interaction", score: 64 },
      { label: "Accuracy", score: 50 }
    ],
    strengths: ["질문을 이해하고 짧게 대답합니다.", "좋아하는 주제에서는 바로 반응합니다."],
    needsPractice: ["답변을 두 문장으로 늘리기", "과거형 동사 안정화"]
  },
  {
    id: "j-eval-2",
    date: "5/20",
    mode: "writing",
    overallScore: 66,
    metrics: [
      { label: "Grammar", score: 54 },
      { label: "Vocabulary", score: 62 },
      { label: "Sentence length", score: 60 },
      { label: "Coherence", score: 56 },
      { label: "Creativity", score: 78 }
    ],
    strengths: ["상상력 있는 소재를 잘 고릅니다.", "because를 넣으려는 시도가 보입니다."],
    needsPractice: ["문장 순서 정리", "and 반복 줄이기"]
  },
  {
    id: "j-eval-3",
    date: "5/23",
    mode: "speaking",
    overallScore: 78,
    metrics: [
      { label: "Fluency", score: 66 },
      { label: "Response length", score: 74 },
      { label: "Interaction", score: 79 },
      { label: "Accuracy", score: 62 }
    ],
    strengths: ["대화 턴을 유지하는 힘이 늘었습니다.", "이유 설명을 스스로 붙이기 시작했습니다."],
    needsPractice: ["긴 문장에서 시제 유지", "because 뒤에 구체적 이유 추가"]
  }
];

const hayoolEvaluations: EvaluationSnapshot[] = [
  {
    id: "h-eval-1",
    date: "5/18",
    mode: "speaking",
    overallScore: 38,
    metrics: [
      { label: "Fluency", score: 30 },
      { label: "Word recall", score: 35 },
      { label: "Interaction", score: 32 },
      { label: "Confidence", score: 28 }
    ],
    strengths: ["색깔 단어를 기억합니다.", "선택지가 있으면 대답합니다."],
    needsPractice: ["I see 문장 시작", "물건 이름 반복"]
  },
  {
    id: "h-eval-2",
    date: "5/21",
    mode: "writing",
    overallScore: 35,
    metrics: [
      { label: "Tracing", score: 48 },
      { label: "Word choice", score: 32 },
      { label: "Sentence start", score: 28 },
      { label: "Spacing", score: 34 }
    ],
    strengths: ["따라 쓰기는 안정적입니다.", "좋아하는 단어를 고를 수 있습니다."],
    needsPractice: ["I like 문장 완성", "단어 사이 띄어쓰기"]
  },
  {
    id: "h-eval-3",
    date: "5/23",
    mode: "speaking",
    overallScore: 54,
    metrics: [
      { label: "Fluency", score: 42 },
      { label: "Word recall", score: 52 },
      { label: "Interaction", score: 48 },
      { label: "Confidence", score: 46 }
    ],
    strengths: ["색깔과 사물 이름을 연결합니다.", "짧은 문장 시작이 덜 부담스러워졌습니다."],
    needsPractice: ["I see + object 반복", "스스로 첫 단어 말하기"]
  }
];

const jiyoolRewardRules: RewardRule[] = [
  {
    id: "j-rule-dual",
    title: "오늘 Writing·Speaking 모두 90점",
    description: "하루에 라이팅과 스피킹 모두 90점 이상이면 +1,000원",
    triggerType: "score_growth",
    targetValue: 90,
    rewardAmount: 1000,
    status: "active"
  },
  {
    id: "j-rule-streak",
    title: "5일 연속 점수 상승",
    description: "최종 점수가 5일 이상 연속 상승하면 +5,000원",
    triggerType: "score_growth",
    targetValue: 5,
    rewardAmount: 5000,
    status: "active"
  }
];

const hayoolRewardRules: RewardRule[] = [
  {
    id: "h-rule-dual",
    title: "오늘 Writing·Speaking 모두 90점",
    description: "하루에 라이팅과 스피킹 모두 90점 이상이면 +1,000원",
    triggerType: "score_growth",
    targetValue: 90,
    rewardAmount: 1000,
    status: "active"
  },
  {
    id: "h-rule-streak",
    title: "5일 연속 점수 상승",
    description: "최종 점수가 5일 이상 연속 상승하면 +5,000원",
    triggerType: "score_growth",
    targetValue: 5,
    rewardAmount: 5000,
    status: "active"
  }
];

const jiyoolSpeakingAttempts: SpeakingAttempt[] = [
  {
    id: "j-speaking-attempt-1",
    date: "2026-05-23",
    topic: "Phone rule opinion",
    transcript: "I think no phone at lunch because students talk friends. But phone can help text parents.",
    score: 78,
    metrics: [
      { label: "Fluency", score: 66 },
      { label: "Pronunciation", score: 76 },
      { label: "Response length", score: 74 },
      { label: "Accuracy", score: 62 }
    ],
    feedbackSections: [
      {
        title: "구조",
        notes: ["의견과 반대 이유를 모두 말했습니다. 주장, 이유 2개, 예시 순서로 정리하면 더 설득력 있습니다."]
      },
      {
        title: "문장",
        notes: ["students talk friends는 students can talk with friends처럼 전치사와 조동사를 넣으면 자연스럽습니다."]
      },
      {
        title: "단어",
        notes: ["phone, lunch, parents처럼 주제 단어를 잘 사용했습니다. contact, focus 같은 단어를 추가해보세요."]
      }
    ],
    referenceSentences: [
      {
        original: "I think no phone at lunch.",
        improved: "I think students should not use phones during lunch because they need time to talk with friends.",
        focus: "clear opinion + because"
      },
      {
        original: "phone can help text parents",
        improved: "However, phones can be useful when students need to contact their parents.",
        focus: "contrast + precise verb"
      }
    ],
    memoryNotes: ["의견 주제에서 찬반을 모두 말하려는 시도가 보입니다.", "with friends 같은 전치사 표현을 안정화해야 합니다."]
  }
];

const jiyoolMemoryNotes: MemoryNote[] = [
  {
    id: "j-memory-1",
    date: "2026-05-23",
    type: "mistake",
    claim: "친구와 관련된 표현에서 with 같은 전치사가 빠지는 경향이 있습니다.",
    evidence: "students talk friends"
  },
  {
    id: "j-memory-2",
    date: "2026-05-23",
    type: "improvement",
    claim: "의견을 말한 뒤 because로 이유를 붙이는 힘이 늘었습니다.",
    evidence: "I think no phone at lunch because..."
  }
];

const hayoolSpeakingAttempts: SpeakingAttempt[] = [
  {
    id: "h-speaking-attempt-1",
    date: "2026-05-23",
    topic: "Class field trip plan",
    transcript: "I want go science museum. We see robots and experiment. It fun because friends.",
    score: 54,
    metrics: [
      { label: "Fluency", score: 42 },
      { label: "Pronunciation", score: 56 },
      { label: "Response length", score: 52 },
      { label: "Accuracy", score: 46 }
    ],
    feedbackSections: [
      {
        title: "구조",
        notes: ["장소, 볼 것, 재미있는 이유를 모두 말하려고 했습니다."]
      },
      {
        title: "문장",
        notes: ["I want go는 I want to go로, It fun은 It would be fun으로 말하면 더 정확합니다."]
      },
      {
        title: "단어",
        notes: ["science museum, robots, experiments처럼 현장학습 주제 단어를 잘 골랐습니다."]
      }
    ],
    referenceSentences: [
      {
        original: "I want go science museum.",
        improved: "I want to go to a science museum for our class field trip.",
        focus: "want to go to + place"
      },
      {
        original: "It fun because friends.",
        improved: "It would be fun because I could learn new things with my friends.",
        focus: "because + clear reason"
      }
    ],
    memoryNotes: ["want to go to + 장소 패턴을 반복하면 현장학습 설명이 더 자연스러워집니다."]
  }
];

const hayoolMemoryNotes: MemoryNote[] = [
  {
    id: "h-memory-1",
    date: "2026-05-23",
    type: "strategy",
    claim: "장소를 먼저 말한 뒤 볼 것과 이유를 붙이면 더 길게 말할 수 있습니다.",
    evidence: "I want go science museum. We see robots..."
  }
];

export const demoStudents: StudentDashboard[] = [
  {
    student: {
      id: "jiyool",
      displayName: "Jiyool",
      email: defaultFamilyEmails.jiyool,
      cefrLevel: "A1+",
      usGradeLevel: "Grade 7",
      levelDescription: "미국 학생 기준 중1 수준"
    },
    todayTask: {
      id: "task-jiyool-today",
      mode: "speaking",
      prompt: "Your school is considering a rule that limits phone use during lunch. Record a 45-second opinion: state your position, give two reasons, and end with one example from school life.",
      targetSkills: ["reason_giving", "sentence_expansion"],
      rewardValue: 1,
      generatedReason: "Jiyool은 상상하는 주제에서 문장을 더 길게 말합니다.",
      successCriteria: ["3번 이상 대답하기", "because 1번 사용", "new word 1개 사용"]
    },
    speakingTask: {
      id: "speaking-jiyool-today",
      mode: "speaking",
      prompt: "Your school is considering a rule that limits phone use during lunch. Record a 45-second opinion: state your position, give two reasons, and end with one example from school life.",
      targetSkills: ["opinion_structure", "evidence", "sentence_repair"],
      rewardValue: 1,
      generatedReason: "Grade 7 수준에서는 의견, 이유, 예시를 구조적으로 말하는 연습이 중요합니다.",
      successCriteria: ["녹음 1회 이상", "주장 1개", "이유 2개", "개선 문장을 참고해 전체 답변 다시 말하기"]
    },
    writingTask: {
      id: "writing-jiyool-today",
      mode: "writing",
      prompt: "Write one paragraph about whether students should be allowed to use phones during lunch. Include a topic sentence, two reasons, and a closing sentence.",
      targetSkills: ["paragraph_structure", "evidence", "coherence"],
      rewardValue: 1,
      generatedReason: "중1 수준의 paragraph 구조와 근거 제시를 연습합니다.",
      successCriteria: ["topic sentence", "two reasons", "closing sentence"]
    },
    recentObservations: [
      {
        id: "j-obs-1",
        type: "growth_signal",
        skill: "reason_giving",
        claim: "because를 사용해 이유를 붙이기 시작했습니다.",
        confidence: 0.82,
        lastSeen: "2026-05-23"
      },
      {
        id: "j-obs-2",
        type: "interest",
        skill: "topic_engagement",
        claim: "학교, 동물, 상상 이야기에서 말이 길어집니다.",
        confidence: 0.78,
        lastSeen: "2026-05-22"
      }
    ],
    skillStates: [
      {
        id: "j-skill-1",
        skill: "Speaking",
        level: "growing",
        score: 64,
        signals: ["짧은 대화 유지 가능", "이유 설명이 늘어남"],
        nextTargets: ["한 답변을 2문장으로 늘리기"]
      },
      {
        id: "j-skill-2",
        skill: "Writing",
        level: "emerging",
        score: 48,
        signals: ["아이디어는 좋음", "문장 연결어 연습 필요"],
        nextTargets: ["because, so로 문장 연결하기"]
      },
      {
        id: "j-skill-3",
        skill: "Confidence",
        level: "growing",
        score: 70,
        signals: ["좋아하는 주제에서 먼저 말함"],
        nextTargets: ["낯선 주제에서 첫 문장 말하기"]
      }
    ],
    lessonHistory: [
      {
        id: "j-history-1",
        date: "2026-05-23",
        mode: "speaking",
        title: "Phone rule opinion",
        score: 78
      },
      {
        id: "j-history-2",
        date: "2026-05-22",
        mode: "writing",
        title: "My favorite animal",
        score: 72
      },
      {
        id: "j-history-3",
        date: "2026-05-21",
        mode: "speaking",
        title: "Weekend story",
        score: 68
      }
    ],
    progressPoints: [
      { date: "5/17", speaking: 48, writing: 42, confidence: 45 },
      { date: "5/18", speaking: 52, writing: 44, confidence: 48 },
      { date: "5/19", speaking: 56, writing: 45, confidence: 54 },
      { date: "5/20", speaking: 59, writing: 46, confidence: 58 },
      { date: "5/21", speaking: 61, writing: 47, confidence: 62 },
      { date: "5/22", speaking: 63, writing: 48, confidence: 66 },
      { date: "5/23", speaking: 64, writing: 50, confidence: 70 }
    ],
    evaluationSnapshots: jiyoolEvaluations,
    speakingAttempts: jiyoolSpeakingAttempts,
    memoryNotes: jiyoolMemoryNotes,
    rewardRules: jiyoolRewardRules,
    rewardBalance: 0,
    rewardLedger: [],
    weeklySummary:
      "상상하는 주제에서 답변 길이가 늘었습니다. 다음 목표는 이유를 두 문장으로 설명하는 것입니다."
  },
  {
    student: {
      id: "hayool",
      displayName: "Hayool",
      email: defaultFamilyEmails.hayool,
      cefrLevel: "A2",
      usGradeLevel: "Grade 5",
      levelDescription: "미국 학생 기준 초5 수준"
    },
    todayTask: {
      id: "task-hayool-today",
      mode: "speaking",
      prompt: "Imagine you are planning a class field trip. Record 5 sentences: where you want to go, what you will see, and why it would be fun.",
      targetSkills: ["sequence", "reason_giving", "confidence"],
      rewardValue: 1,
      generatedReason: "Hayool은 눈앞에 보이는 것을 말할 때 부담이 적습니다.",
      successCriteria: ["단어 5개 말하기", "I see 문장 사용", "마지막에 favorite 말하기"]
    },
    speakingTask: {
      id: "speaking-hayool-today",
      mode: "speaking",
      prompt: "Imagine you are planning a class field trip. Record 5 sentences: where you want to go, what you will see, and why it would be fun.",
      targetSkills: ["sequence", "reason_giving", "sentence_start"],
      rewardValue: 1,
      generatedReason: "Grade 5 수준에서는 생각을 순서대로 말하고 이유를 붙이는 연습이 좋습니다.",
      successCriteria: ["녹음 1회 이상", "5 sentences", "why 문장", "개선 문장을 참고해 전체 답변 다시 말하기"]
    },
    writingTask: {
      id: "writing-hayool-today",
      mode: "writing",
      prompt: "Write a short field trip plan. Include where your class should go, three things you will do there, and why it is a good idea.",
      targetSkills: ["planning", "sequence_words", "reason_giving"],
      rewardValue: 1,
      generatedReason: "초5 수준의 계획 설명과 순서 표현을 연습합니다.",
      successCriteria: ["place", "three activities", "one reason"]
    },
    recentObservations: [
      {
        id: "h-obs-1",
        type: "growth_signal",
        skill: "basic_words",
        claim: "색깔과 물건 이름을 연결해 말할 수 있습니다.",
        confidence: 0.74,
        lastSeen: "2026-05-23"
      },
      {
        id: "h-obs-2",
        type: "skill_pattern",
        skill: "sentence_start",
        claim: "첫 문장을 시작할 때 선택지가 있으면 더 쉽게 말합니다.",
        confidence: 0.69,
        lastSeen: "2026-05-22"
      }
    ],
    skillStates: [
      {
        id: "h-skill-1",
        skill: "Speaking",
        level: "emerging",
        score: 42,
        signals: ["짧은 단어 답변 가능"],
        nextTargets: ["I see 문장으로 말하기"]
      },
      {
        id: "h-skill-2",
        skill: "Writing",
        level: "new",
        score: 25,
        signals: ["따라 쓰기 가능"],
        nextTargets: ["I like 문장 쓰기"]
      },
      {
        id: "h-skill-3",
        skill: "Confidence",
        level: "emerging",
        score: 46,
        signals: ["선택지가 있으면 대답함"],
        nextTargets: ["스스로 첫 단어 말하기"]
      }
    ],
    lessonHistory: [
      {
        id: "h-history-1",
        date: "2026-05-23",
        mode: "speaking",
        title: "Class field trip plan",
        score: 54
      },
      {
        id: "h-history-2",
        date: "2026-05-22",
        mode: "speaking",
        title: "Toy words",
        score: 49
      }
    ],
    progressPoints: [
      { date: "5/17", speaking: 30, writing: 20, confidence: 28 },
      { date: "5/18", speaking: 33, writing: 21, confidence: 31 },
      { date: "5/19", speaking: 35, writing: 22, confidence: 34 },
      { date: "5/20", speaking: 38, writing: 23, confidence: 38 },
      { date: "5/21", speaking: 40, writing: 24, confidence: 41 },
      { date: "5/22", speaking: 41, writing: 24, confidence: 44 },
      { date: "5/23", speaking: 42, writing: 25, confidence: 46 }
    ],
    evaluationSnapshots: hayoolEvaluations,
    speakingAttempts: hayoolSpeakingAttempts,
    memoryNotes: hayoolMemoryNotes,
    rewardRules: hayoolRewardRules,
    rewardBalance: 0,
    rewardLedger: [],
    weeklySummary:
      "짧은 단어 답변이 안정되고 있습니다. 다음 목표는 I see, I like 문장으로 말하는 것입니다."
  }
];

export type QuickLoginEntry = {
  label: string;
  email: string;
  role: FamilyRole;
};

export function getQuickLoginEntries(): QuickLoginEntry[] {
  const entries: QuickLoginEntry[] = demoStudents.map((entry) => ({
    label: entry.student.displayName,
    email: entry.student.email,
    role: "student"
  }));
  entries.push({
    label: "Parent",
    email: defaultFamilyEmails.parent,
    role: "parent"
  });
  return entries;
}

export function findDemoUser(email: string): FamilyUser | null {
  const normalized = email.trim().toLowerCase();
  const student = demoStudents.find((entry) => entry.student.email.toLowerCase() === normalized);

  if (student) {
    return {
      email: student.student.email,
      role: "student",
      studentId: student.student.id,
      displayName: student.student.displayName
    };
  }

  if (normalized === defaultFamilyEmails.parent.toLowerCase()) {
    return {
      email: defaultFamilyEmails.parent,
      role: "parent",
      displayName: "Parent"
    };
  }

  return null;
}

export function createDemoDashboard(user: FamilyUser): DashboardData {
  return {
    currentUser: user,
    activeStudentId: user.studentId ?? demoStudents[0].student.id,
    students: demoStudents
  };
}

export const demoDashboard = createDemoDashboard({
  email: defaultFamilyEmails.jiyool,
  role: "student",
  studentId: "jiyool",
  displayName: "Jiyool"
});
