"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { AvatarButton } from "@/components/avatar";
import { Envelope, Microphone, Notebook, RotateCcw, Star } from "@/components/illustrations";
import {
  SpeakingHistorySection,
  WritingHistorySection,
  type SpeakingSessionRow,
  type WritingSessionRow
} from "@/components/session-history";
import { SessionDetailModal } from "@/components/session-detail-modal";
import { DailyJourneyChart } from "@/components/daily-journey-chart";
import type {
  DashboardData,
  EvaluationSnapshot,
  LearningEventResponse,
  ReferenceSentence,
  SpeakingAttempt,
  SpeakingAttemptResponse,
  SpeakingFeedbackSection,
  EvaluationMetric,
  StudentDashboard,
  TaskMode
} from "@/lib/types";

type FamilyTutorAppProps = {
  initialData: DashboardData;
};

type AppTab = "writing" | "speaking" | "reward";
type ModeSubTab = "today" | "growth";

type SelectedSession =
  | { kind: "speaking"; session: SpeakingSessionRow }
  | { kind: "writing"; session: WritingSessionRow };

type WritingScoreTrailItem = {
  id: string;
  label: string;
  score: number;
  delta?: number;
};

const writingIdeas = [
  "First, choose one place or one character.",
  "Add one feeling: happy, surprised, nervous, excited.",
  "Use because to explain why.",
  "End with one sentence about what happens next."
];

export function FamilyTutorApp({ initialData }: FamilyTutorAppProps) {
  const [students, setStudents] = useState<StudentDashboard[]>(initialData.students);
  const activeStudentId = initialData.activeStudentId;
  const [activeTab, setActiveTab] = useState<AppTab>("speaking");
  const [subTab, setSubTab] = useState<ModeSubTab>("today");
  const questMode: TaskMode = activeTab === "writing" ? "writing" : "speaking";
  const setQuestMode = (mode: TaskMode) => setActiveTab(mode);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);
  const [writingDraft, setWritingDraft] = useState("");
  const [brainstorming, setBrainstorming] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<LearningEventResponse | null>(null);
  const [writingPracticeInputs, setWritingPracticeInputs] = useState<Record<string, string>>({});
  const [writingScoreTrail, setWritingScoreTrail] = useState<WritingScoreTrailItem[]>([]);
  const [retryMode, setRetryMode] = useState(false);
  const [speakingFeedback, setSpeakingFeedback] = useState<SpeakingAttemptResponse | null>(null);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "evaluating">("idle");
  const [recordingError, setRecordingError] = useState("");
  const [heardReference, setHeardReference] = useState<ReferenceSentence | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const referenceAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeStudent = useMemo(
    () => students.find((entry) => entry.student.id === activeStudentId) ?? students[0],
    [activeStudentId, students]
  );

  function updateActiveStudent(updater: (student: StudentDashboard) => StudentDashboard) {
    setStudents((current) =>
      current.map((entry) => (entry.student.id === activeStudent.student.id ? updater(entry) : entry))
    );
  }

  const setWritingPracticeInput = useCallback((sentence: string, value: string) => {
    setWritingPracticeInputs((current) => ({ ...current, [sentence]: value }));
  }, []);

  async function completeQuest(mode: TaskMode, answer: string, isRevision = false) {
    if (answer.trim().length < 2 || isSubmitting) {
      return;
    }

    const previousWritingScore =
      mode === "writing" && isRevision ? feedback?.evaluationSnapshot?.overallScore : undefined;
    const previousWritingAnswer =
      mode === "writing" && isRevision ? feedback?.writingFeedback?.submittedText : undefined;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/learning-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          studentId: activeStudent.student.id,
          taskId: mode === "writing" ? activeStudent.writingTask.id : activeStudent.speakingTask.id,
          mode,
          answer,
          isRevision,
          previousAnswer: previousWritingAnswer,
          previousScore: previousWritingScore
        })
      });

      if (!response.ok) {
        throw new Error("Failed to complete quest");
      }

      const result = (await response.json()) as LearningEventResponse;
      setFeedback(result);
      if (mode === "writing") {
        setWritingPracticeInputs({});
        if (result.evaluationSnapshot) {
          setWritingScoreTrail((current) => {
            const score = result.evaluationSnapshot?.overallScore ?? 0;

            if (!isRevision) {
              return [
                {
                  id: `writing-score-${Date.now()}`,
                  label: "처음 글",
                  score
                }
              ];
            }

            const rewriteCount = current.filter((entry) => entry.label.startsWith("다시")).length + 1;
            const previousScore = result.revisionComparison?.previousScore ?? current[current.length - 1]?.score ?? score;

            return [
              ...current,
              {
                id: `writing-score-${Date.now()}`,
                label: `다시 ${rewriteCount}번`,
                score,
                delta: result.revisionComparison?.scoreDelta ?? score - previousScore
              }
            ].slice(-6);
          });
        }
      }

      updateActiveStudent((student) => ({
        ...student,
        todayTask: result.nextTask,
        recentObservations: [...result.observations, ...student.recentObservations].slice(0, 8),
        skillStates: result.skillStates.length ? result.skillStates : student.skillStates,
        rewardRules: result.rewardRules ?? student.rewardRules,
        evaluationSnapshots: result.evaluationSnapshot
          ? [...student.evaluationSnapshots, result.evaluationSnapshot]
          : student.evaluationSnapshots,
        lessonHistory: [
          {
            id: `history-${Date.now()}`,
            date: new Date().toISOString().slice(0, 10),
            mode,
            title: mode === "writing" ? (isRevision ? "Writing rewrite" : "Writing quest") : "Speaking quest",
            score: result.evaluationSnapshot?.overallScore ?? 75
          },
          ...student.lessonHistory
        ].slice(0, 10)
      }));

      if (mode === "writing") {
        setWritingDraft("");
        setRetryMode(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function onRetryWriting() {
    setWritingDraft("");
    setRetryMode(true);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const pad = document.querySelector(".writing-desk .word-pad") as HTMLTextAreaElement | null;
        pad?.focus();
        pad?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  function onRetrySpeaking() {
    setSpeakingFeedback(null);
    setHeardReference(null);
    setRecordingError("");
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const orb = document.querySelector(".voice-studio") as HTMLElement | null;
        orb?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  function startBrainstorming() {
    setBrainstorming(writingIdeas);
  }

  async function speakReference(sentence: ReferenceSentence) {
    setHeardReference(sentence);

    referenceAudioRef.current?.pause();
    window.speechSynthesis?.cancel();

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: sentence.improved
        })
      });

      if (!response.ok) {
        throw new Error("TTS request failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      referenceAudioRef.current = audio;
      await audio.play();
      return;
    } catch {
      playBrowserVoice(sentence.improved);
    }
  }

  function playBrowserVoice(text: string) {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  }

  async function startRecording() {
    setRecordingError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError("이 브라우저에서 마이크 녹음을 사용할 수 없습니다.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          audioChunksRef.current = [];
          setRecordingState("idle");
          return;
        }
        void submitSpeakingAudio(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingState("recording");
    } catch {
      setRecordingError("마이크 권한이 필요합니다. 브라우저에서 마이크 사용을 허용해 주세요.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      setRecordingState("evaluating");
      mediaRecorderRef.current.stop();
    }
  }

  function cancelRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      discardRecordingRef.current = true;
      recorder.stop();
    } else {
      audioChunksRef.current = [];
      setRecordingState("idle");
    }
    setRecordingError("");
  }

  async function submitSpeakingAudio(audioBlob: Blob) {
    const previousScore = activeStudent.speakingAttempts[0]?.score;
    const formData = new FormData();
    formData.set("studentId", activeStudent.student.id);
    formData.set("taskId", activeStudent.speakingTask.id);
    formData.set("topic", activeStudent.speakingTask.prompt);
    formData.set("attemptNumber", String(activeStudent.speakingAttempts.length + 1));
    formData.set("previousScore", String(previousScore ?? ""));
    formData.set("audio", audioBlob, `speaking-${Date.now()}.webm`);

    try {
      const response = await fetch("/api/speaking-attempts", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Failed to evaluate speaking attempt");
      }

      const result = (await response.json()) as SpeakingAttemptResponse;
      setSpeakingFeedback(result);
      setHeardReference(null);
      updateActiveStudent((student) => ({
        ...student,
        speakingAttempts: [result.attempt, ...student.speakingAttempts].slice(0, 12),
        evaluationSnapshots: [...student.evaluationSnapshots, result.evaluationSnapshot],
        recentObservations: [...result.observations, ...student.recentObservations].slice(0, 10),
        memoryNotes: [...result.memoryNotes, ...student.memoryNotes].slice(0, 20),
        lessonHistory: [
          {
            id: `speaking-history-${Date.now()}`,
            date: new Date().toISOString().slice(0, 10),
            mode: "speaking" as const,
            title: `Speaking attempt ${student.speakingAttempts.length + 1}`,
            score: result.attempt.score
          },
          ...student.lessonHistory
        ].slice(0, 10)
      }));
    } catch {
      setRecordingError("평가 중 문제가 생겼습니다. 다시 녹음해 주세요.");
    } finally {
      setRecordingState("idle");
    }
  }

  async function logOut() {
    await fetch("/api/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  async function refreshTask(mode: TaskMode) {
    const response = await fetch("/api/tasks/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    });
    if (!response.ok) {
      return;
    }
    const { task } = await response.json();
    if (!task) return;
    updateActiveStudent((student) => ({
      ...student,
      ...(mode === "speaking" ? { speakingTask: task } : { writingTask: task }),
      todayTask: task
    }));
    if (mode === "writing") {
      setFeedback(null);
      setWritingDraft("");
      setWritingPracticeInputs({});
      setWritingScoreTrail([]);
      setRetryMode(false);
    } else {
      setSpeakingFeedback(null);
      setHeardReference(null);
      setRecordingError("");
    }
  }

  return (
    <main className="game-shell">
      <section className="game-stage">
        <header
          className="stage-topbar"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <AvatarButton
              studentId={activeStudent.student.id}
              studentName={activeStudent.student.displayName}
              size={60}
              shape="rounded"
              crop="bust"
            />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <strong style={{ fontSize: "1.35rem", fontWeight: 600 }}>
                {activeStudent.student.displayName}
              </strong>
              <small style={{ color: "var(--ink-soft)", fontSize: "1rem" }}>
                {activeStudent.student.cefrLevel} · {activeStudent.student.usGradeLevel} · {latestOverallScore(activeStudent)}점
              </small>
            </div>
          </div>

          <nav className="game-tabs" aria-label="Main tabs">
            {[
              ["writing", "Writing"],
                ["speaking", "Speaking"],
                ["reward", "Reward"]
              ].map(([key, label]) => (
                <button
                  className={activeTab === key ? "active" : ""}
                  key={key}
                  onClick={() => setActiveTab(key as AppTab)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </nav>
            <button className="logout-button" onClick={logOut} type="button">
              Log out
            </button>
          </header>

          {activeTab === "writing" || activeTab === "speaking" ? (
            <div className="mode-tab-stack" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <nav
                aria-label="Sub views"
                style={{
                  display: "flex",
                  gap: 4,
                  borderBottom: "1px solid var(--line)"
                }}
              >
                {(
                  [
                    ["today", "오늘"],
                    ["growth", "성장"]
                  ] as Array<[ModeSubTab, string]>
                ).map(([key, label]) => {
                  const active = subTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSubTab(key)}
                      style={{
                        padding: "16px 26px",
                        background: "transparent",
                        border: "none",
                        borderBottom: active
                          ? "3px solid var(--accent)"
                          : "3px solid transparent",
                        color: active ? "var(--ink)" : "var(--ink-soft)",
                        fontWeight: active ? 600 : 500,
                        cursor: "pointer",
                        fontSize: "1.25rem",
                        marginBottom: -1
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </nav>

              {subTab === "today" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <section
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 18,
                      padding: 20,
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 14
                    }}
                  >
                    <AvatarButton
                      studentId={activeStudent.student.id}
                      studentName={activeStudent.student.displayName}
                      size={112}
                      shape="rounded"
                      crop="bust"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ margin: 0, lineHeight: 1.3, fontSize: "1.85rem" }}>
                        안녕 {activeStudent.student.displayName}!
                      </h2>
                      <p style={{ margin: "10px 0 0", color: "var(--ink-soft)", lineHeight: 1.55, fontSize: "1.2rem" }}>
                        {activeTab === "writing"
                          ? "오늘은 어떤 글을 써볼까? 천천히 생각해보고 시작해도 돼."
                          : "오늘은 어떤 이야기를 해볼까? 준비되면 녹음 버튼을 눌러봐."}
                      </p>
                    </div>
                  </section>

                  <PlayView
                    activeStudent={activeStudent}
                    completeQuest={completeQuest}
                    feedback={feedback}
                    isSubmitting={isSubmitting}
                    questMode={questMode}
                    recordingError={recordingError}
                    recordingState={recordingState}
                    heardReference={heardReference}
                    onRetryWriting={onRetryWriting}
                    onRetrySpeaking={onRetrySpeaking}
                    refreshTask={refreshTask}
                    retryMode={retryMode}
                    setQuestMode={setQuestMode}
                    setWritingPracticeInput={setWritingPracticeInput}
                    setWritingDraft={setWritingDraft}
                    speakingFeedback={speakingFeedback}
                    speakReference={speakReference}
                    startRecording={startRecording}
                    startBrainstorming={startBrainstorming}
                    stopRecording={stopRecording}
                    cancelRecording={cancelRecording}
                    writingDraft={writingDraft}
                    writingPracticeInputs={writingPracticeInputs}
                    writingScoreTrail={writingScoreTrail}
                    brainstorming={brainstorming}
                  />
                </div>
              ) : null}

              {subTab === "growth" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <section className="quest-board">
                    <DailyJourneyChart
                      tries={
                        activeTab === "speaking"
                          ? activeStudent.speakingAttempts.map((a) => ({
                              date: a.date,
                              score: a.score
                            }))
                          : activeStudent.lessonHistory
                              .filter((l) => l.mode === "writing")
                              .map((l) => ({ date: l.date, score: l.score }))
                      }
                      title={
                        activeTab === "writing"
                          ? "Writing 일자별 점수 + 그날의 도전 흐름"
                          : "Speaking 일자별 점수 + 그날의 도전 흐름"
                      }
                      caption="막대 높이는 그날의 최고 점수. 막대 안의 가로선은 그날 시도했던 나머지 점수들이에요."
                    />
                  </section>

                  <section className="quest-board">
                    <div className="quest-title-row">
                      <div>
                        <p className="tiny-label">Skills</p>
                        <h2>내가 키우는 능력</h2>
                      </div>
                    </div>
                    <div className="skill-cloud">
                      {activeStudent.skillStates.map((skill) => (
                        <div className="skill-token" key={skill.id}>
                          <strong>{skill.skill}</strong>
                          <span>{skill.score}/100</span>
                          <div className="meter">
                            <i style={{ width: `${skill.score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="quest-board">
                    <div className="quest-title-row">
                      <div>
                        <p className="tiny-label">Records</p>
                        <h2>{activeTab === "writing" ? "내가 쓴 것들" : "내가 말한 것들"}</h2>
                      </div>
                    </div>
                    {activeTab === "speaking" ? (
                      <SpeakingHistorySection
                        attempts={activeStudent.speakingAttempts}
                        emptyMessage="아직 말한 기록이 없어요. 오늘 탭에서 도전해 보세요."
                        onSelectSession={(session) =>
                          setSelectedSession({ kind: "speaking", session })
                        }
                      />
                    ) : (
                      <WritingHistorySection
                        lessonHistory={activeStudent.lessonHistory}
                        evaluationSnapshots={activeStudent.evaluationSnapshots}
                        emptyMessage="아직 쓴 기록이 없어요. 오늘 탭에서 도전해 보세요."
                        onSelectSession={(session) =>
                          setSelectedSession({ kind: "writing", session })
                        }
                      />
                    )}
                  </section>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "reward" ? <RewardView activeStudent={activeStudent} /> : null}
      </section>

      {selectedSession ? (
        selectedSession.kind === "speaking" ? (
          <SessionDetailModal
            kind="speaking"
            session={selectedSession.session}
            onClose={() => setSelectedSession(null)}
          />
        ) : (
          <SessionDetailModal
            kind="writing"
            session={selectedSession.session}
            onClose={() => setSelectedSession(null)}
          />
        )
      ) : null}
    </main>
  );
}

function PlayView({
  activeStudent,
  brainstorming,
  completeQuest,
  feedback,
  isSubmitting,
  questMode,
  recordingError,
  recordingState,
  heardReference,
  onRetryWriting,
  onRetrySpeaking,
  refreshTask,
  retryMode,
  setQuestMode,
  setWritingPracticeInput,
  setWritingDraft,
  speakingFeedback,
  speakReference,
  startRecording,
  startBrainstorming,
  stopRecording,
  cancelRecording,
  writingDraft,
  writingPracticeInputs,
  writingScoreTrail
}: {
  activeStudent: StudentDashboard;
  brainstorming: string[];
  completeQuest: (mode: TaskMode, answer: string, isRevision?: boolean) => Promise<void>;
  feedback: LearningEventResponse | null;
  isSubmitting: boolean;
  questMode: TaskMode;
  recordingError: string;
  recordingState: "idle" | "recording" | "evaluating";
  heardReference: ReferenceSentence | null;
  onRetryWriting: () => void;
  onRetrySpeaking: () => void;
  refreshTask: (mode: TaskMode) => Promise<void>;
  retryMode: boolean;
  setQuestMode: (mode: TaskMode) => void;
  setWritingPracticeInput: (sentence: string, value: string) => void;
  setWritingDraft: (value: string) => void;
  speakingFeedback: SpeakingAttemptResponse | null;
  speakReference: (sentence: ReferenceSentence) => void;
  startRecording: () => Promise<void>;
  startBrainstorming: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  writingDraft: string;
  writingPracticeInputs: Record<string, string>;
  writingScoreTrail: WritingScoreTrailItem[];
}) {
  const writingFeedback = questMode === "writing" ? feedback?.writingFeedback : undefined;
  const practiceSentences = writingFeedback?.sentencePractices ?? [];
  const writingPracticeComplete =
    !writingFeedback ||
    practiceSentences.length === 0 ||
    practiceSentences.every((sentence) =>
      isPracticeMatched(writingPracticeInputs[sentence.improved] ?? "", sentence.improved)
    );

  return (
    <div className="play-grid">
      {questMode === "speaking" ? (
        <section className="activity-shell speaking-shell">
          <div className="thread-panel">
            <div className="lesson-message coach">
              <span className="message-avatar">O</span>
              <div className="message-card prompt-card">
                <div className="prompt-card-head">
                  <p className="tiny-label">Today · Speaking</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      className="soft-button prompt-refresh"
                      type="button"
                      onClick={() => refreshTask("speaking")}
                      style={{ marginTop: 0, alignSelf: "auto" }}
                    >
                      ↻ 다른 주제 받기
                    </button>
                    <Microphone size={44} />
                  </div>
                </div>
                <h2>{activeStudent.speakingTask.prompt}</h2>
                <p>녹음 버튼을 누르고 영어로 답해 보세요. 답변이 끝나면 전체 내용을 평가하고 더 자연스러운 문장으로 다시 말할 수 있게 도와줍니다.</p>
              </div>
            </div>

            <div className="voice-studio">
            <div className="voice-panel">
              <div className={`record-orb ${recordingState}`}>
                <span>{recordingState === "recording" ? "Recording" : recordingState === "evaluating" ? "Checking" : "Ready"}</span>
                <div className="voice-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="record-actions">
                <div className="record-buttons">
                  <button
                    className="quest-submit"
                    onClick={startRecording}
                    type="button"
                    disabled={recordingState !== "idle"}
                  >
                    Start recording
                  </button>
                  <button
                    className="quest-submit stop"
                    onClick={stopRecording}
                    type="button"
                    disabled={recordingState !== "recording"}
                  >
                    Stop recording
                  </button>
                  <button
                    className="record-reset"
                    onClick={cancelRecording}
                    type="button"
                    disabled={recordingState !== "recording"}
                    aria-label="다시 시작"
                    title="녹음한 내용을 버리고 처음부터 다시"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
                <p>
                  {recordingState === "recording"
                    ? "실수했으면 ↻ 로 다시 시작, 다 말했으면 Stop recording 으로 평가받기."
                    : recordingState === "evaluating"
                      ? "평가 중이에요... 잠시만요."
                      : "준비되면 Start recording 을 눌러 영어로 답해보세요."}
                </p>
              </div>
            </div>

          </div>

          {recordingError ? <div className="voice-error">{recordingError}</div> : null}

          {speakingFeedback ? (
            <SpeakingReview
              attempt={speakingFeedback.attempt}
              metrics={speakingFeedback.attempt.metrics}
              feedbackSections={speakingFeedback.attempt.feedbackSections}
              referenceSentences={speakingFeedback.nextReferenceSentences}
              attempts={activeStudent.speakingAttempts}
              heardReference={heardReference}
              onSpeakReference={speakReference}
              onRetry={onRetrySpeaking}
            />
          ) : null}

          </div>
        </section>
      ) : (
        <section className="activity-shell writing-shell">
          <div className="writing-prompt-row">
            <div className="lesson-message coach">
              <span className="message-avatar">O</span>
              <div className="message-card prompt-card">
                <div className="prompt-card-head">
                  <p className="tiny-label">Today · Writing</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      className="soft-button prompt-refresh"
                      type="button"
                      onClick={() => refreshTask("writing")}
                      style={{ marginTop: 0, alignSelf: "auto" }}
                    >
                      ↻ 다른 주제 받기
                    </button>
                    <Notebook size={44} />
                  </div>
                </div>
                <h2>{activeStudent.writingTask.prompt}</h2>
                <p>먼저 생각을 편하게 쓰고, 평가 후에는 더 좋은 문장으로 다시 작성해 점수를 올려 봅니다.</p>
              </div>
            </div>
            <button className="soft-button" onClick={startBrainstorming} type="button">
              Brainstorm
            </button>
          </div>
          {brainstorming.length ? (
            <div className="idea-strip">
              {brainstorming.map((idea) => (
                <span key={idea}>{idea}</span>
              ))}
            </div>
          ) : null}
          {writingFeedback ? (
            <WritingReview
              evaluation={feedback?.evaluationSnapshot}
              feedback={writingFeedback}
              practiceInputs={writingPracticeInputs}
              practiceComplete={writingPracticeComplete}
              revisionComparison={feedback?.revisionComparison}
              setWritingPracticeInput={setWritingPracticeInput}
              scoreTrail={writingScoreTrail}
              onRetry={onRetryWriting}
            />
          ) : null}
          {!writingFeedback || retryMode ? (
            <div className="writing-desk">
              <div className="editor-shell">
                <div className="editor-toolbar">
                  <p className="tiny-label">
                    {writingFeedback ? `Round ${(writingScoreTrail.length || 0) + 1} · 새 도전` : "First draft"}
                  </p>
                  <span>{writingDraft.trim().split(/\s+/).filter(Boolean).length} words</span>
                </div>
                {writingFeedback && retryMode ? (
                  <div className="kid-retry-banner">
                    <strong>🚀 새로운 도전 시작!</strong>
                    <p>처음부터 새로 써봐요. 위에서 본 팁을 떠올리며 한 줄씩 천천히.</p>
                  </div>
                ) : null}
                <div className="editor-action-panel">
                  {writingFeedback && !writingPracticeComplete ? (
                    <p className="practice-warning">위 문장 파워업을 따라 써본 뒤 도전할 수 있어요.</p>
                  ) : (
                    <p>
                      {writingFeedback
                        ? "마음에 들 때까지 고쳐 써도 좋아요. 다 되면 점수 받으러 가요!"
                        : "문장과 흐름을 정리한 뒤 제출하세요."}
                    </p>
                  )}
                  <button
                    className="quest-submit"
                    onClick={() => completeQuest("writing", writingDraft, Boolean(writingFeedback))}
                    type="button"
                    disabled={isSubmitting || writingDraft.trim().length < 2 || !writingPracticeComplete}
                  >
                    {writingFeedback ? "🎯 다시 점수 받기" : "Finish Quest"}
                  </button>
                </div>
                <textarea
                  aria-label="Writing pad"
                  className="word-pad"
                  value={writingDraft}
                  onChange={(event) => setWritingDraft(event.target.value)}
                  placeholder={
                    writingFeedback
                      ? "새 도전! 처음부터 자유롭게 다시 써봐요..."
                      : "Once upon a time..."
                  }
                />
              </div>
            </div>
          ) : null}
        </section>
      )}

      {feedback ? (
        <div className="level-up-strip">
          <div className="level-up-head">
            <Star size={20} />
            <strong>Lesson complete</strong>
          </div>
          <span>{feedback.feedbackForChild}</span>
        </div>
      ) : null}
    </div>
  );
}

function SpeakingReview({
  attempt,
  metrics,
  feedbackSections,
  referenceSentences,
  attempts,
  heardReference,
  onSpeakReference,
  onRetry
}: {
  attempt: SpeakingAttempt;
  metrics: EvaluationMetric[];
  feedbackSections: SpeakingFeedbackSection[];
  referenceSentences: ReferenceSentence[];
  attempts: SpeakingAttempt[];
  heardReference: ReferenceSentence | null;
  onSpeakReference: (sentence: ReferenceSentence) => void;
  onRetry: () => void;
}) {
  const score = attempt.score;
  const orderedAttempts = useMemo(() => [...attempts].reverse(), [attempts]);
  const currentIndex = orderedAttempts.findIndex((a) => a.id === attempt.id);
  const previousAttempt = currentIndex > 0 ? orderedAttempts[currentIndex - 1] : null;
  const previousScore = previousAttempt?.score;
  const improved = previousScore !== undefined && score > previousScore;
  const sameScore = previousScore !== undefined && score === previousScore;
  const dropped = previousScore !== undefined && score < previousScore;
  const scoreDelta = previousScore !== undefined ? score - previousScore : 0;
  const bestScore = orderedAttempts.reduce((max, a) => Math.max(max, a.score), 0);
  const isNewBest = orderedAttempts.length > 1 && score >= bestScore;
  const isFirst = previousScore === undefined;

  const headline = improved
    ? "와! 더 잘 말했어요 🎉"
    : sameScore
      ? "다시 도전한 게 멋져요! 💪"
      : dropped
        ? "다시 도전한 용기가 빛나요 ✨"
        : "오늘의 말하기 완료! 🌟";

  const subline = isFirst
    ? "잘 말했어요. 아래 팁을 따라 한 번 더 말해 봐요."
    : improved
      ? `지난 번 ${previousScore}점에서 ${score}점으로 올라갔어요.`
      : sameScore
        ? "점수는 같지만, 한 번 더 말해 본 것 자체가 성장이에요."
        : "점수가 조금 내려갔지만 괜찮아요. 새 표현을 시도해 본 거니까요.";

  return (
    <div className="writing-review kid">
      <div className={`kid-score-hero ${improved ? "celebrate" : ""}`}>
        <div className="kid-score-hero__score">
          <span>My Score</span>
          <strong>{score}</strong>
          {isNewBest ? <em className="best-badge">최고 점수!</em> : null}
        </div>
        <div className="kid-score-hero__message">
          <h3>{headline}</h3>
          <p>{subline}</p>
          {previousScore !== undefined ? (
            <div className="kid-score-delta">
              <span className="prev">{previousScore}</span>
              <span className="arrow" aria-hidden="true">→</span>
              <span className="now">{score}</span>
              <span className={`delta ${improved ? "up" : dropped ? "down" : "same"}`}>
                {scoreDelta > 0 ? "+" : ""}
                {scoreDelta}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {orderedAttempts.length > 1 ? (
        <div className="kid-score-trail">
          <p className="tiny-label">👣 내 도전 발자국</p>
          <div>
            {orderedAttempts.map((a, index) => {
              const isLast = index === orderedAttempts.length - 1;
              const prevA = index > 0 ? orderedAttempts[index - 1] : null;
              const delta = prevA ? a.score - prevA.score : 0;
              const sign = delta > 0 ? "up" : delta < 0 ? "down" : "same";
              const isBest = a.score === bestScore;
              const classes = [isLast ? "current" : "", sign, isBest ? "best" : ""]
                .filter(Boolean)
                .join(" ");
              return (
                <span key={a.id} className={classes}>
                  {isBest ? (
                    <i className="trail-best" aria-label="최고 점수">★</i>
                  ) : null}
                  {prevA ? (
                    <i className={`trail-delta ${sign}`} aria-label={`${delta >= 0 ? "+" : ""}${delta}점`}>
                      {delta > 0 ? "↑" : delta < 0 ? "↓" : "·"}
                      {Math.abs(delta)}
                    </i>
                  ) : null}
                  <strong>{a.score}</strong>
                  <small>{index + 1}번째</small>
                  {isLast ? <em className="trail-now">지금</em> : null}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="kid-card kid-transcript">
        <p className="tiny-label">내가 말한 것</p>
        <p>{attempt.transcript}</p>
      </div>

      {metrics.length ? (
        <div className="kid-card kid-metrics">
          <p className="tiny-label">세부 점수</p>
          <div className="kid-metric-chips">
            {metrics.map((metric) => (
              <span key={metric.label}>
                {metric.label} <strong>{metric.score}</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {feedbackSections.length ? (
        <div className="kid-card kid-tips">
          <p className="tiny-label">다음엔 이걸 해봐요</p>
          <ul>
            {feedbackSections.map((section) => (
              <li key={section.title}>
                <strong>{section.title}</strong>
                {section.notes.slice(0, 1).map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {referenceSentences.length ? (
        <div className="kid-card kid-power-ups">
          <p className="tiny-label">문장 파워업 — 듣고 따라 말해봐요</p>
          <p className="kid-card__help">
            아래 문장을 들어본 뒤, 한 번 더 녹음해 봐요. 비슷한 표현을 내 말로 써보면 점수가 오를 거예요!
          </p>
          <div className="reference-drill kid-reference-drill">
            {referenceSentences.map((sentence) => (
              <button
                className={heardReference?.improved === sentence.improved ? "selected" : ""}
                key={sentence.improved}
                onClick={() => onSpeakReference(sentence)}
                type="button"
              >
                <strong>{sentence.improved}</strong>
                <span>
                  {sentence.original ? `내가 말한 것: "${sentence.original}" · ` : ""}
                  {sentence.focus} · 들어보기
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="kid-retry">
        <div className="kid-retry__copy">
          <h3>다시 녹음해 볼래요?</h3>
          <p>
            {improved
              ? "한 번 더 말하면 점수가 또 올라갈 수 있어요! 새 표현도 써봐요."
              : "위 문장을 듣고, 새로운 표현으로 다시 도전해 봐요."}
          </p>
        </div>
        <button
          className="kid-retry__button"
          onClick={onRetry}
          type="button"
        >
          <span aria-hidden="true">🎤</span> 다시 녹음하기
        </button>
      </div>
    </div>
  );
}

function WritingReview({
  evaluation,
  feedback,
  practiceInputs,
  practiceComplete,
  revisionComparison,
  scoreTrail,
  onRetry,
  setWritingPracticeInput
}: {
  evaluation?: EvaluationSnapshot;
  feedback: NonNullable<LearningEventResponse["writingFeedback"]>;
  practiceInputs: Record<string, string>;
  practiceComplete: boolean;
  revisionComparison?: LearningEventResponse["revisionComparison"];
  scoreTrail: WritingScoreTrailItem[];
  onRetry: () => void;
  setWritingPracticeInput: (sentence: string, value: string) => void;
}) {
  const score = evaluation?.overallScore ?? 0;
  const improved = !!revisionComparison && revisionComparison.scoreDelta > 0;
  const sameScore = !!revisionComparison && revisionComparison.scoreDelta === 0;
  const dropped = !!revisionComparison && revisionComparison.scoreDelta < 0;
  const bestScore = scoreTrail.reduce((max, entry) => Math.max(max, entry.score), 0);
  const isNewBest = scoreTrail.length > 1 && score >= bestScore;

  const headline = improved
    ? "와! 점수가 올랐어요 🎉"
    : sameScore
      ? "끝까지 다시 도전했어요! 💪"
      : dropped
        ? "다시 도전한 용기가 멋져요 ✨"
        : "오늘의 글쓰기 완료! 🌟";

  const subline = revisionComparison
    ? improved
      ? `지난 번 ${revisionComparison.previousScore}점에서 ${revisionComparison.currentScore}점으로 올라갔어요.`
      : sameScore
        ? `점수는 같지만, 한 번 더 써본 것 자체가 큰 성장이에요.`
        : `점수가 조금 내려갔지만 괜찮아요. 다른 표현을 시도해 본 거니까요.`
    : "잘 썼어요. 아래 팁을 보면 다음엔 더 멋진 글이 될 거예요.";

  const strengths = feedback.rubricSections
    .filter((section) => section.score >= 75)
    .slice(0, 3);
  const growthAreas = feedback.rubricSections
    .filter((section) => section.score < 75)
    .slice(0, 3);

  return (
    <div className="writing-review kid">
      <div className={`kid-score-hero ${improved ? "celebrate" : ""}`}>
        <div className="kid-score-hero__score">
          <span>My Score</span>
          <strong>{score}</strong>
          {isNewBest ? <em className="best-badge">최고 점수!</em> : null}
        </div>
        <div className="kid-score-hero__message">
          <h3>{headline}</h3>
          <p>{subline}</p>
          {revisionComparison ? (
            <div className="kid-score-delta">
              <span className="prev">{revisionComparison.previousScore}</span>
              <span className="arrow" aria-hidden="true">→</span>
              <span className="now">{revisionComparison.currentScore}</span>
              <span className={`delta ${improved ? "up" : dropped ? "down" : "same"}`}>
                {revisionComparison.scoreDelta > 0 ? "+" : ""}
                {revisionComparison.scoreDelta}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {scoreTrail.length > 1 ? (
        <div className="kid-score-trail">
          <p className="tiny-label">👣 내 도전 발자국</p>
          <div>
            {scoreTrail.map((entry, index) => {
              const isLast = index === scoreTrail.length - 1;
              const delta = entry.delta ?? 0;
              const sign = delta > 0 ? "up" : delta < 0 ? "down" : "same";
              const isBest = entry.score === bestScore;
              const hasDelta = typeof entry.delta === "number";
              const classes = [isLast ? "current" : "", sign, isBest ? "best" : ""]
                .filter(Boolean)
                .join(" ");
              return (
                <span key={entry.id} className={classes}>
                  {isBest ? (
                    <i className="trail-best" aria-label="최고 점수">★</i>
                  ) : null}
                  {hasDelta ? (
                    <i className={`trail-delta ${sign}`} aria-label={`${delta >= 0 ? "+" : ""}${delta}점`}>
                      {delta > 0 ? "↑" : delta < 0 ? "↓" : "·"}
                      {Math.abs(delta)}
                    </i>
                  ) : null}
                  <strong>{entry.score}</strong>
                  <small>{entry.label}</small>
                  {isLast ? <em className="trail-now">지금</em> : null}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {revisionComparison && revisionComparison.improvements.length ? (
        <div className="kid-card kid-improved">
          <p className="tiny-label">이번에 더 잘한 점</p>
          <ul>
            {revisionComparison.improvements.map((item) => (
              <li key={item}>
                <span aria-hidden="true">⭐</span> {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {strengths.length ? (
        <div className="kid-card kid-strengths">
          <p className="tiny-label">잘하고 있는 것</p>
          <ul>
            {strengths.map((section) => (
              <li key={section.title}>
                <strong>{section.title}</strong>
                {section.notes.slice(0, 1).map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {growthAreas.length ? (
        <div className="kid-card kid-tips">
          <p className="tiny-label">다음엔 이걸 해봐요</p>
          <ul>
            {growthAreas.map((section) => (
              <li key={section.title}>
                <strong>{section.title}</strong>
                {section.notes.slice(0, 1).map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback.revisionPlan.length ? (
        <div className="kid-card kid-plan">
          <p className="tiny-label">다시 쓸 때 챙겨봐요</p>
          <ol>
            {feedback.revisionPlan.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {feedback.sentencePractices.length ? (
        <div className="kid-card kid-power-ups">
          <p className="tiny-label">문장 파워업 — 따라 써보기</p>
          <p className="kid-card__help">
            아래 문장을 똑같이 타이핑하면 다시 도전할 수 있어요. 입에 익으면 내 글에도 써먹어 봐요!
          </p>
          <div className="writing-practice-list">
            {feedback.sentencePractices.map((sentence) => (
              <PracticeSentenceCard
                key={sentence.improved}
                sentence={sentence}
                typed={practiceInputs[sentence.improved] ?? ""}
                onChange={setWritingPracticeInput}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="kid-retry">
        <div className="kid-retry__copy">
          <h3>다시 도전해 볼래요?</h3>
          <p>
            {improved
              ? "한 번 더 쓰면 점수가 또 올라갈 수 있어요! 새로운 문장도 써봐요."
              : practiceComplete
                ? "위 팁을 머리에 넣고, 처음부터 새로운 글로 도전해 봐요."
                : "위 문장을 한 번 따라 써본 뒤, 새 도전을 시작할 수 있어요."}
          </p>
        </div>
        <button
          className="kid-retry__button"
          onClick={onRetry}
          type="button"
          disabled={!practiceComplete}
        >
          <span aria-hidden="true">↻</span> 다시 도전하기
        </button>
      </div>

      <details className="kid-teacher-note">
        <summary>
          <span className="tiny-label">참고 — 선생님의 멋진 버전</span>
          <small>지금 안 봐도 괜찮아요. 내가 먼저 도전한 다음에 비교해 봐요.</small>
        </summary>
        <p>{feedback.revisedText}</p>
      </details>
    </div>
  );
}

type PracticeSentenceCardProps = {
  sentence: ReferenceSentence;
  typed: string;
  onChange: (sentence: string, value: string) => void;
};

const PracticeSentenceCard = memo(function PracticeSentenceCard({
  sentence,
  typed,
  onChange
}: PracticeSentenceCardProps) {
  const matched = isPracticeMatched(typed, sentence.improved);
  const mirrorContent = useMemo(
    () => (typed.length === 0 ? null : renderPracticeMirror(typed, sentence.improved)),
    [typed, sentence.improved]
  );

  return (
    <label className={matched ? "matched" : ""}>
      {sentence.original ? <span>내 문장: {sentence.original}</span> : null}
      <strong>{sentence.improved}</strong>
      <small>{sentence.focus}</small>
      <div className="practice-field">
        <div className="practice-field__mirror" aria-hidden="true">
          {mirrorContent ?? (
            <span className="practice-field__placeholder">Type the improved sentence here</span>
          )}
        </div>
        <textarea
          className="practice-field__input"
          aria-label={`Type practice sentence: ${sentence.improved}`}
          value={typed}
          rows={1}
          onChange={(event) => onChange(sentence.improved, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          onScroll={(event) => {
            const mirror = event.currentTarget.previousElementSibling as HTMLDivElement | null;
            if (mirror) mirror.scrollLeft = event.currentTarget.scrollLeft;
          }}
          placeholder="Type the improved sentence here"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </label>
  );
});

function isPracticeMatched(input: string, target: string) {
  return normalizePracticeText(input) === normalizePracticeText(target);
}

function normalizePracticeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function classifyTypedWords(typedWords: string[], targetWords: string[]): Array<"ok" | "wrong"> {
  const m = typedWords.length;
  const n = targetWords.length;
  if (m === 0) return [];
  if (n === 0) return new Array(m).fill("wrong" as const);

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (typedWords[i - 1].toLowerCase() === targetWords[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: Array<"ok" | "wrong"> = new Array(m).fill("wrong");
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (typedWords[i - 1].toLowerCase() === targetWords[j - 1].toLowerCase()) {
      result[i - 1] = "ok";
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      result[i - 1] = "wrong";
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return result;
}

function renderPracticeMirror(typed: string, target: string) {
  const segments = typed.split(/(\s+)/);
  const typedWords: string[] = [];
  const wordSegmentIndex: number[] = [];
  segments.forEach((segment, index) => {
    if (segment && !/^\s+$/.test(segment)) {
      typedWords.push(segment);
      wordSegmentIndex.push(index);
    }
  });

  const targetWords = target.trim().split(/\s+/).filter(Boolean);
  const endsWithWhitespace = /\s$/.test(typed);
  const lastWordIsPending = !endsWithWhitespace && typedWords.length > 0;
  const wordsToClassify = lastWordIsPending ? typedWords.slice(0, -1) : typedWords;
  const classifications = classifyTypedWords(wordsToClassify, targetWords);

  return segments.map((segment, segmentIndex) => {
    if (!segment) return null;
    const wordPosition = wordSegmentIndex.indexOf(segmentIndex);
    if (wordPosition === -1) {
      return <span key={`s-${segmentIndex}`}>{segment}</span>;
    }
    const isPendingWord = lastWordIsPending && wordPosition === typedWords.length - 1;
    const kind: "ok" | "wrong" | "pending" = isPendingWord
      ? "pending"
      : classifications[wordPosition] ?? "wrong";
    return (
      <span key={`w-${segmentIndex}`} className={`practice-field__word ${kind}`}>
        {segment}
      </span>
    );
  });
}

function RewardView({
  activeStudent
}: {
  activeStudent: StudentDashboard;
}) {
  const rules = activeStudent.rewardRules;
  const ledger = activeStudent.rewardLedger ?? [];
  const balance = activeStudent.rewardBalance ?? 0;
  const nextPayout = formatNextPayout();
  const wonFormatter = new Intl.NumberFormat("ko-KR");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section className="quest-board reward-world">
        <div className="quest-title-row">
          <div>
            <p className="tiny-label">My piggy bank</p>
            <h2>지금까지 모은 돈</h2>
          </div>
          <Envelope size={56} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginTop: 8,
            marginBottom: 12
          }}
        >
          <strong
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3.2rem",
              fontVariantNumeric: "tabular-nums",
              color: "var(--accent)",
              lineHeight: 1
            }}
          >
            {wonFormatter.format(balance)}
          </strong>
          <span style={{ fontSize: "1.4rem", color: "var(--ink-soft)" }}>원</span>
        </div>

        <p
          style={{
            margin: 0,
            padding: "12px 16px",
            background: "var(--sand)",
            borderRadius: 12,
            color: "var(--ink)",
            fontSize: "1rem",
            lineHeight: 1.55
          }}
        >
          📅 <strong>매월 1일</strong>에 그동안 모은 금액이 지급됩니다.
          <span style={{ color: "var(--ink-soft)" }}> 다음 지급일: {nextPayout}</span>
        </p>
      </section>

      <section className="quest-board">
        <div className="quest-title-row">
          <div>
            <p className="tiny-label">Bonus rules</p>
            <h2>적립 방법</h2>
          </div>
        </div>

        {rules.length === 0 ? (
          <p className="big-plain">아직 등록된 보너스가 없어요.</p>
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: 12, listStyle: "none", padding: 0, margin: 0 }}>
            {rules.map((rule) => (
              <li
                key={rule.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: 16,
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background: "var(--surface)"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: "1.1rem", marginBottom: 4 }}>
                    {rule.title}
                  </strong>
                  {rule.description ? (
                    <span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>
                      {rule.description}
                    </span>
                  ) : null}
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "var(--moss-wash)",
                    color: "var(--moss)",
                    fontSize: "1rem",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums"
                  }}
                >
                  +{wonFormatter.format(rule.rewardAmount)}원
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ledger.length > 0 ? (
        <section className="quest-board">
          <div className="quest-title-row">
            <div>
              <p className="tiny-label">Recent</p>
              <h2>최근 적립 내역</h2>
            </div>
          </div>
          <ul style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
            {ledger.slice(0, 12).map((item) => (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--line-soft)"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "1rem", color: "var(--ink)" }}>{item.reason}</p>
                  <span style={{ fontSize: "0.85rem", color: "var(--ink-faint)" }}>
                    {item.createdAt.slice(0, 10).replace(/-/g, ".")}
                  </span>
                </div>
                <strong
                  style={{
                    color: "var(--moss)",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: "1.05rem"
                  }}
                >
                  +{wonFormatter.format(item.amount)}원
                </strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function formatNextPayout(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${nextMonth.getFullYear()}년 ${nextMonth.getMonth() + 1}월 1일`;
}

function latestOverallScore(student: StudentDashboard) {
  return student.evaluationSnapshots.at(-1)?.overallScore ?? student.lessonHistory[0]?.score ?? 0;
}
