export type TaskMode = "speaking" | "writing";

export type SkillLevel = "new" | "emerging" | "growing" | "strong";

export type FamilyRole = "student" | "parent";

export type FamilyUser = {
  email: string;
  role: FamilyRole;
  studentId?: string;
  displayName: string;
};

export type Student = {
  id: string;
  displayName: string;
  email: string;
  cefrLevel: string;
  usGradeLevel: string;
  levelDescription: string;
};

export type DailyTask = {
  id: string;
  prompt: string;
  mode: TaskMode;
  targetSkills: string[];
  rewardValue: number;
  generatedReason: string;
  successCriteria: string[];
};

export type SpeakingFeedbackSection = {
  title: string;
  notes: string[];
};

export type ReferenceSentence = {
  original?: string;
  improved: string;
  focus: string;
};

export type WritingFeedbackSection = {
  title: string;
  score: number;
  notes: string[];
};

export type WritingEvaluationDetails = {
  submittedText: string;
  revisedText: string;
  rubricSections: WritingFeedbackSection[];
  sentencePractices: ReferenceSentence[];
  revisionPlan: string[];
};

export type WritingRevisionComparison = {
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  improvements: string[];
  remainingTargets: string[];
};

export type SpeakingAttempt = {
  id: string;
  date: string;
  topic: string;
  transcript: string;
  score: number;
  metrics: EvaluationMetric[];
  feedbackSections: SpeakingFeedbackSection[];
  referenceSentences: ReferenceSentence[];
  memoryNotes: string[];
};

export type MemoryNote = {
  id: string;
  date: string;
  claim: string;
  evidence: string;
  type: "mistake" | "improvement" | "strategy" | "interest";
};

export type Observation = {
  id: string;
  type: string;
  skill: string;
  claim: string;
  confidence: number;
  lastSeen: string;
};

export type SkillState = {
  id: string;
  skill: string;
  level: SkillLevel;
  score: number;
  signals: string[];
  nextTargets: string[];
};

export type EvaluationMetric = {
  label: string;
  score: number;
};

export type EvaluationSnapshot = {
  id: string;
  date: string;
  mode: TaskMode;
  overallScore: number;
  metrics: EvaluationMetric[];
  strengths: string[];
  needsPractice: string[];
};

export type RewardRule = {
  id: string;
  title: string;
  description: string;
  triggerType: "attendance_count" | "score_growth";
  targetValue: number;
  rewardAmount: number;
  status: "active" | "completed" | "paused";
};

export type LessonHistoryItem = {
  id: string;
  date: string;
  mode: TaskMode;
  title: string;
  score: number;
  prompt?: string;
  rawInput?: string;
};

export type ProgressPoint = {
  date: string;
  speaking: number;
  writing: number;
  confidence: number;
};

export type RewardLedgerItem = {
  id: string;
  amount: number;
  reason: string;
  sourceType: "daily_task" | "skill_milestone" | "parent_adjustment";
  createdAt: string;
};

export type StudentDashboard = {
  student: Student;
  todayTask: DailyTask;
  speakingTask: DailyTask;
  writingTask: DailyTask;
  recentObservations: Observation[];
  skillStates: SkillState[];
  lessonHistory: LessonHistoryItem[];
  progressPoints: ProgressPoint[];
  evaluationSnapshots: EvaluationSnapshot[];
  speakingAttempts: SpeakingAttempt[];
  memoryNotes: MemoryNote[];
  rewardRules: RewardRule[];
  rewardBalance: number;
  rewardLedger: RewardLedgerItem[];
  weeklySummary: string;
};

export type DashboardData = {
  currentUser: FamilyUser;
  activeStudentId: string;
  students: StudentDashboard[];
};

export type LearningEventRequest = {
  studentId: string;
  taskId: string;
  mode: TaskMode;
  answer: string;
  isRevision?: boolean;
  previousAnswer?: string;
  previousScore?: number;
};

export type LearningEventResponse = {
  feedbackForChild: string;
  parentNote: string;
  evaluationSnapshot?: EvaluationSnapshot;
  writingFeedback?: WritingEvaluationDetails;
  revisionComparison?: WritingRevisionComparison;
  observations: Observation[];
  skillStates: SkillState[];
  rewardRules?: RewardRule[];
  nextTask: DailyTask;
};

export type SpeakingAttemptResponse = {
  attempt: SpeakingAttempt;
  evaluationSnapshot: EvaluationSnapshot;
  observations: Observation[];
  nextReferenceSentences: ReferenceSentence[];
  memoryNotes: MemoryNote[];
};
