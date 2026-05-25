"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { AvatarButton } from "@/components/avatar";
import { Envelope, Microphone, Notebook, Star } from "@/components/illustrations";
import {
  SpeakingHistorySection,
  WritingHistorySection,
  type SpeakingSessionRow,
  type WritingSessionRow
} from "@/components/session-history";
import { SessionDetailModal } from "@/components/session-detail-modal";
import { ModeScoreSparkline } from "@/components/mode-score-sparkline";
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
type ModeSubTab = "today" | "history" | "progress";

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
                  label: "Draft 1",
                  score
                }
              ];
            }

            const rewriteCount = current.filter((entry) => entry.label.startsWith("Rewrite")).length + 1;
            const previousScore = result.revisionComparison?.previousScore ?? current[current.length - 1]?.score ?? score;

            return [
              ...current,
              {
                id: `writing-score-${Date.now()}`,
                label: `Rewrite ${rewriteCount}`,
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
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
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

  return (
    <main className="game-shell">
      <div className="game-layout">
        <aside className="history-rail" aria-label="수업 기록">
          <div className="mini-profile">
            <AvatarButton
              studentId={activeStudent.student.id}
              studentName={activeStudent.student.displayName}
              size={200}
              shape="rounded"
              crop="bust"
            />
            <div className="mini-profile-meta">
              <strong>{activeStudent.student.displayName}</strong>
              <span>{activeStudent.student.email}</span>
              <small className="mini-profile-level">{activeStudent.student.cefrLevel}</small>
            </div>
          </div>
          <h2>History</h2>
          <div className="history-list">
            {activeStudent.lessonHistory.map((item) => (
              <div className="history-pill" key={item.id}>
                <span>{item.mode === "speaking" ? "Talk" : "Write"}</span>
                <strong>{item.title}</strong>
                <small>
                  {item.date} · {item.score} pts
                </small>
              </div>
            ))}
          </div>
        </aside>

        <section className="game-stage">
          <header className="stage-topbar">
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
                    ["history", "기록"],
                    ["progress", "성장"]
                  ] as Array<[ModeSubTab, string]>
                ).map(([key, label]) => {
                  const active = subTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSubTab(key)}
                      style={{
                        padding: "10px 16px",
                        background: "transparent",
                        border: "none",
                        borderBottom: active
                          ? "2px solid var(--accent)"
                          : "2px solid transparent",
                        color: active ? "var(--ink)" : "var(--ink-soft)",
                        fontWeight: active ? 600 : 500,
                        cursor: "pointer",
                        fontSize: "0.95rem",
                        marginBottom: -1
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </nav>

              {subTab === "today" ? (
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
                  retryMode={retryMode}
                  setQuestMode={setQuestMode}
                  setWritingPracticeInput={setWritingPracticeInput}
                  setWritingDraft={setWritingDraft}
                  speakingFeedback={speakingFeedback}
                  speakReference={speakReference}
                  startRecording={startRecording}
                  startBrainstorming={startBrainstorming}
                  stopRecording={stopRecording}
                  writingDraft={writingDraft}
                  writingPracticeInputs={writingPracticeInputs}
                  writingScoreTrail={writingScoreTrail}
                  brainstorming={brainstorming}
                />
              ) : null}

              {subTab === "history" ? (
                <section className="quest-board">
                  <div className="quest-title-row">
                    <div>
                      <p className="tiny-label">My History</p>
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
              ) : null}

              {subTab === "progress" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <ModeScoreSparkline
                    snapshots={activeStudent.evaluationSnapshots}
                    mode={activeTab}
                    label={activeTab === "writing" ? "Writing 점수 흐름" : "Speaking 점수 흐름"}
                  />
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
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "reward" ? <RewardView activeStudent={activeStudent} /> : null}
        </section>
      </div>

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
  retryMode,
  setQuestMode,
  setWritingPracticeInput,
  setWritingDraft,
  speakingFeedback,
  speakReference,
  startRecording,
  startBrainstorming,
  stopRecording,
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
  retryMode: boolean;
  setQuestMode: (mode: TaskMode) => void;
  setWritingPracticeInput: (sentence: string, value: string) => void;
  setWritingDraft: (value: string) => void;
  speakingFeedback: SpeakingAttemptResponse | null;
  speakReference: (sentence: ReferenceSentence) => void;
  startRecording: () => Promise<void>;
  startBrainstorming: () => void;
  stopRecording: () => void;
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
      <WorkspaceHeader activeStudent={activeStudent} questMode={questMode} setQuestMode={setQuestMode} />

      {questMode === "speaking" ? (
        <section className="activity-shell speaking-shell">
          <div className="thread-panel">
            <div className="lesson-message coach">
              <span className="message-avatar">O</span>
              <div className="message-card prompt-card">
                <div className="prompt-card-head">
                  <p className="tiny-label">Today · Speaking</p>
                  <Microphone size={44} />
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
                {recordingState === "recording" ? (
                  <button className="quest-submit stop" onClick={stopRecording} type="button">
                    Stop recording
                  </button>
                ) : (
                  <button className="quest-submit" onClick={startRecording} type="button" disabled={recordingState === "evaluating"}>
                    Start recording
                  </button>
                )}
                <p>
                  녹음이 끝나면 평가 후 같은 주제로 다시 말합니다.
                </p>
              </div>
            </div>

            <div className="attempt-history">
              <p className="tiny-label">Attempt history</p>
              <div>
                {activeStudent.speakingAttempts.map((attempt, index) => (
                  <span key={attempt.id}>
                    Try {activeStudent.speakingAttempts.length - index}: {attempt.score}
                  </span>
                ))}
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
                  <Notebook size={44} />
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

function WorkspaceHeader({
  activeStudent,
  questMode
}: {
  activeStudent: StudentDashboard;
  questMode: TaskMode;
  setQuestMode: (mode: TaskMode) => void;
}) {
  const latestScore = latestOverallScore(activeStudent);

  return (
    <section className="workspace-header">
      <div>
        <p className="tiny-label">Today's room</p>
        <h2>{questMode === "speaking" ? "Let's talk in English" : "Write your best draft"}</h2>
      </div>
      <div className="workspace-stats" aria-label="Current progress">
        <span>{latestScore} score</span>
        <span>{activeStudent.student.usGradeLevel}</span>
      </div>
    </section>
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
          <p className="tiny-label">내 도전 기록</p>
          <div>
            {orderedAttempts.map((a, index) => {
              const isLast = index === orderedAttempts.length - 1;
              const prevA = index > 0 ? orderedAttempts[index - 1] : null;
              const delta = prevA ? a.score - prevA.score : 0;
              const sign = delta > 0 ? "up" : delta < 0 ? "down" : "same";
              return (
                <span key={a.id} className={`${isLast ? "current" : ""} ${sign}`}>
                  <strong>{a.score}</strong>
                  <small>
                    Try {index + 1}
                    {prevA ? ` · ${delta >= 0 ? "+" : ""}${delta}` : ""}
                  </small>
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
          <p className="tiny-label">내 도전 기록</p>
          <div>
            {scoreTrail.map((entry, index) => {
              const isLast = index === scoreTrail.length - 1;
              const delta = entry.delta ?? 0;
              const sign = delta > 0 ? "up" : delta < 0 ? "down" : "same";
              return (
                <span key={entry.id} className={`${isLast ? "current" : ""} ${sign}`}>
                  <strong>{entry.score}</strong>
                  <small>
                    {entry.label}
                    {typeof entry.delta === "number" ? ` · ${entry.delta >= 0 ? "+" : ""}${entry.delta}` : ""}
                  </small>
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

  return (
    <section className="quest-board reward-world">
      <div className="quest-title-row">
        <div>
          <p className="tiny-label">My rewards</p>
          <h2>지금 도전 중인 보상</h2>
        </div>
        <Envelope size={48} />
      </div>

      {rules.length === 0 ? (
        <p className="big-plain">아직 등록된 보상이 없습니다. 부모님과 함께 만들어 보세요.</p>
      ) : (
        <ul className="reward-rule-cards">
          {rules.map((rule) => {
            const progress = Math.min(100, Math.round((rule.currentValue / rule.targetValue) * 100));
            const remaining = Math.max(0, rule.targetValue - rule.currentValue);
            return (
              <li key={rule.id}>
                <div className="reward-rule-card-head">
                  <div>
                    <strong>{rule.title}</strong>
                    {rule.description ? <span className="rule-description">{rule.description}</span> : null}
                  </div>
                  <span className="reward-amount-pill">{rule.rewardItem}</span>
                </div>
                <div className="reward-rule-card-stats">
                  <span>{rule.triggerType === "attendance_count" ? "출석 성실도" : "종합 점수"}</span>
                  <span>
                    {rule.currentValue} / {rule.targetValue}
                    {remaining > 0 ? ` · ${remaining} 남음` : " · 달성!"}
                  </span>
                </div>
                <div className="meter">
                  <i style={{ width: `${progress}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function latestOverallScore(student: StudentDashboard) {
  return student.evaluationSnapshots.at(-1)?.overallScore ?? student.lessonHistory[0]?.score ?? 0;
}
