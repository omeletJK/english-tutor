"use client";

import { useMemo, useState } from "react";
import type {
  EvaluationSnapshot,
  LessonHistoryItem,
  SpeakingAttempt
} from "@/lib/types";

/* ---------------------------------------------------------------- *
 * Date-grouped session history shared by the parent detail view
 * and the student Progress tab. One row per (date, prompt) pair,
 * expand to see every try with full transcript + AI feedback.
 * ---------------------------------------------------------------- */

export type SessionRow<TAttempt> = {
  id: string;
  date: string;
  topic: string;
  attempts: TAttempt[];
  initialScore: number;
  finalScore: number;
  bestScore: number;
  delta: number;
};

export type SpeakingSessionRow = SessionRow<SpeakingAttempt>;
export type WritingSessionRow = SessionRow<WritingAttempt>;

export type WritingAttempt = LessonHistoryItem & { snapshot?: EvaluationSnapshot };

export function SpeakingHistorySection({
  attempts,
  emptyMessage = "아직 Speaking 기록이 없어요.",
  onSelectSession
}: {
  attempts: SpeakingAttempt[];
  emptyMessage?: string;
  onSelectSession?: (session: SpeakingSessionRow) => void;
}) {
  const sessions = useMemo(() => groupSpeakingByDate(attempts), [attempts]);
  const [openId, setOpenId] = useState<string | null>(
    onSelectSession ? null : sessions[0]?.id ?? null
  );

  if (sessions.length === 0) {
    return (
      <section className="quest-board">
        <p className="empty-note">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="log-section">
      {sessions.map((session) => (
        <SessionRowCard
          key={session.id}
          session={session}
          isOpen={onSelectSession ? false : openId === session.id}
          onToggle={
            onSelectSession
              ? () => onSelectSession(session)
              : () => setOpenId(openId === session.id ? null : session.id)
          }
          asTrigger={Boolean(onSelectSession)}
        >
          {!onSelectSession &&
            session.attempts.map((attempt, index) => (
              <SpeakingAttemptCard
                attempt={attempt}
                attemptIndex={index + 1}
                isBest={attempt.score === session.bestScore}
                key={attempt.id}
              />
            ))}
        </SessionRowCard>
      ))}
    </section>
  );
}

export function WritingHistorySection({
  lessonHistory,
  evaluationSnapshots,
  emptyMessage = "아직 Writing 기록이 없어요.",
  onSelectSession
}: {
  lessonHistory: LessonHistoryItem[];
  evaluationSnapshots: EvaluationSnapshot[];
  emptyMessage?: string;
  onSelectSession?: (session: WritingSessionRow) => void;
}) {
  const sessions = useMemo(
    () => groupWritingByDate(lessonHistory, evaluationSnapshots),
    [lessonHistory, evaluationSnapshots]
  );
  const [openId, setOpenId] = useState<string | null>(
    onSelectSession ? null : sessions[0]?.id ?? null
  );

  if (sessions.length === 0) {
    return (
      <section className="quest-board">
        <p className="empty-note">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="log-section">
      {sessions.map((session) => (
        <SessionRowCard
          key={session.id}
          session={session}
          isOpen={onSelectSession ? false : openId === session.id}
          onToggle={
            onSelectSession
              ? () => onSelectSession(session)
              : () => setOpenId(openId === session.id ? null : session.id)
          }
          asTrigger={Boolean(onSelectSession)}
        >
          {!onSelectSession &&
            session.attempts.map((attempt, index) => (
              <WritingAttemptCard
                attempt={attempt}
                attemptIndex={index + 1}
                isBest={attempt.score === session.bestScore}
                prompt={session.topic}
                key={attempt.id}
              />
            ))}
        </SessionRowCard>
      ))}
    </section>
  );
}

/* ---------- Reusable building blocks ---------- */

function SessionRowCard<TAttempt>({
  session,
  isOpen,
  onToggle,
  children,
  asTrigger = false
}: {
  session: SessionRow<TAttempt>;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  asTrigger?: boolean;
}) {
  const tries = session.attempts.length;
  const showArc = tries > 1;
  const lift = session.delta;
  const liftSign = lift > 0 ? `+${lift}` : `${lift}`;
  const liftTone = lift > 0 ? "var(--moss)" : lift < 0 ? "var(--accent)" : "var(--ink-soft)";

  return (
    <article className={`log-card ${isOpen ? "open" : ""}`}>
      <button
        className="log-card-head"
        onClick={onToggle}
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          width: "100%",
          textAlign: "left"
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="tiny-label" style={{ whiteSpace: "nowrap" }}>
            <span>{formatSessionDate(session.date)}</span>
            <span style={{ opacity: 0.5, margin: "0 6px" }}>·</span>
            <span>{tries}번 시도</span>
          </p>
          <strong style={{ display: "block", marginTop: 4, lineHeight: 1.45 }}>
            {session.topic}
          </strong>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {showArc ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                background: "var(--sand)",
                color: "var(--ink-soft)",
                fontSize: "0.85rem",
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap"
              }}
            >
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                {session.initialScore}
              </strong>
              <span style={{ opacity: 0.5 }}>→</span>
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>
                {session.finalScore}
              </strong>
              <span
                style={{
                  marginLeft: 4,
                  color: liftTone,
                  fontWeight: 600,
                  fontSize: "0.78rem"
                }}
              >
                {liftSign}
              </span>
            </span>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 12px",
                borderRadius: 999,
                background: "var(--sand)",
                color: "var(--ink)",
                fontSize: "0.9rem",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap"
              }}
            >
              {session.finalScore}점
            </span>
          )}
          {showArc && session.bestScore !== session.finalScore ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 10px",
                borderRadius: 999,
                background: "var(--moss-wash)",
                color: "var(--moss)",
                fontSize: "0.78rem",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap"
              }}
            >
              최고 {session.bestScore}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            style={{
              fontSize: 14,
              color: "var(--ink-soft)",
              marginLeft: 4,
              transition: "transform 0.2s ease",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
            }}
          >
            {asTrigger ? "›" : "▾"}
          </span>
        </div>
      </button>
      {isOpen ? <div className="log-card-body">{children}</div> : null}
    </article>
  );
}

export function SpeakingAttemptCard({
  attempt,
  attemptIndex,
  isBest
}: {
  attempt: SpeakingAttempt;
  attemptIndex: number;
  isBest: boolean;
}) {
  return (
    <div className="attempt-card">
      <div className="attempt-head">
        <div>
          <p className="tiny-label">Try {attemptIndex}{isBest ? " · 최고 점수" : ""}</p>
          <span className="attempt-date">{attempt.date}</span>
        </div>
        <strong className="attempt-score">{attempt.score}</strong>
      </div>
      <div className="attempt-transcript">
        <p className="tiny-label">답변</p>
        <p>{attempt.transcript}</p>
      </div>
      {attempt.metrics.length > 0 ? (
        <div className="metric-chips">
          {attempt.metrics.map((metric) => (
            <span key={metric.label}>
              {metric.label} {metric.score}
            </span>
          ))}
        </div>
      ) : null}
      {attempt.feedbackSections.length > 0 ? (
        <div className="feedback-grid">
          {attempt.feedbackSections.map((section) => (
            <div className="feedback-section" key={section.title}>
              <strong>{section.title}</strong>
              {section.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {attempt.referenceSentences.length > 0 ? (
        <div className="attempt-references">
          <p className="tiny-label">더 좋은 문장</p>
          {attempt.referenceSentences.map((sentence) => (
            <div className="reference-item" key={sentence.improved}>
              <strong>{sentence.improved}</strong>
              <span>{sentence.focus}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WritingAttemptCard({
  attempt,
  attemptIndex,
  isBest,
  prompt
}: {
  attempt: WritingAttempt;
  attemptIndex: number;
  isBest: boolean;
  prompt: string;
}) {
  const isRevision = attemptIndex > 1;
  return (
    <div className="attempt-card">
      <div className="attempt-head">
        <div>
          <p className="tiny-label">
            {isRevision ? `Rewrite ${attemptIndex - 1}` : "Draft 1"}
            {isBest ? " · 최고 점수" : ""}
          </p>
          <span className="attempt-date">{attempt.date}</span>
        </div>
        <strong className="attempt-score">{attempt.score}</strong>
      </div>
      {prompt ? (
        <div className="attempt-transcript">
          <p className="tiny-label">받은 질문</p>
          <p>{prompt}</p>
        </div>
      ) : null}
      {attempt.rawInput ? (
        <div className="attempt-transcript">
          <p className="tiny-label">작성한 글</p>
          <p>{attempt.rawInput}</p>
        </div>
      ) : null}
      {attempt.snapshot?.metrics.length ? (
        <div className="metric-chips">
          {attempt.snapshot.metrics.map((metric) => (
            <span key={metric.label}>
              {metric.label} {metric.score}
            </span>
          ))}
        </div>
      ) : null}
      {attempt.snapshot?.strengths.length ? (
        <div className="attempt-references">
          <p className="tiny-label">잘한 점</p>
          {attempt.snapshot.strengths.map((item) => (
            <p key={item} className="strength-line">
              {item}
            </p>
          ))}
        </div>
      ) : null}
      {attempt.snapshot?.needsPractice.length ? (
        <div className="attempt-references">
          <p className="tiny-label">더 연습할 점</p>
          {attempt.snapshot.needsPractice.map((item) => (
            <p key={item} className="practice-line">
              {item}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatSessionDate(date: string): string {
  return date.replace(/-/g, ".");
}

function groupSpeakingByDate(attempts: SpeakingAttempt[]): SessionRow<SpeakingAttempt>[] {
  const map = new Map<string, SpeakingAttempt[]>();
  for (const attempt of attempts) {
    const key = `${attempt.date}::${attempt.topic}`;
    const list = map.get(key) ?? [];
    list.push(attempt);
    map.set(key, list);
  }

  const rows: SessionRow<SpeakingAttempt>[] = [];
  for (const [key, group] of map.entries()) {
    const ordered = [...group].reverse(); // oldest first
    const [date, topic] = key.split("::");
    rows.push({
      id: key,
      date,
      topic,
      attempts: ordered,
      initialScore: ordered[0].score,
      finalScore: ordered[ordered.length - 1].score,
      bestScore: Math.max(...ordered.map((a) => a.score)),
      delta: ordered[ordered.length - 1].score - ordered[0].score
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

function groupWritingByDate(
  history: LessonHistoryItem[],
  snapshots: EvaluationSnapshot[]
): SessionRow<WritingAttempt>[] {
  const writingHistory = history.filter((item) => item.mode === "writing");
  const writingSnapshots = snapshots.filter((s) => s.mode === "writing");

  const paired: WritingAttempt[] = writingHistory.map((item, i) => ({
    ...item,
    snapshot: writingSnapshots[i]
  }));

  const map = new Map<string, WritingAttempt[]>();
  for (const attempt of paired) {
    const key = `${attempt.date}::${attempt.prompt ?? attempt.title}`;
    const list = map.get(key) ?? [];
    list.push(attempt);
    map.set(key, list);
  }

  const rows: SessionRow<WritingAttempt>[] = [];
  for (const [key, group] of map.entries()) {
    const ordered = [...group].reverse();
    const [date, topic] = key.split("::");
    rows.push({
      id: key,
      date,
      topic: topic || "Writing quest",
      attempts: ordered,
      initialScore: ordered[0].score,
      finalScore: ordered[ordered.length - 1].score,
      bestScore: Math.max(...ordered.map((a) => a.score)),
      delta: ordered[ordered.length - 1].score - ordered[0].score
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
