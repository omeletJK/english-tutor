"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  DashboardData,
  EvaluationSnapshot,
  LessonHistoryItem,
  RewardRule,
  SpeakingAttempt,
  StudentDashboard
} from "@/lib/types";
import { ScoreHistory } from "@/components/score-history";

type ParentChildDetailProps = {
  dashboard: DashboardData;
  student: StudentDashboard;
};

type Section = "overview" | "speaking" | "writing" | "rewards" | "settings";

const SECTIONS: Array<{ key: Section; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "speaking", label: "Speaking" },
  { key: "writing", label: "Writing" },
  { key: "rewards", label: "Rewards" },
  { key: "settings", label: "Settings" }
];

export function ParentChildDetail({ student }: ParentChildDetailProps) {
  const [section, setSection] = useState<Section>("overview");

  async function logOut() {
    await fetch("/api/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <main className="game-shell">
      <header className="game-topbar">
        <div>
          <Link className="back-link" href="/parent">
            ← 자녀 선택
          </Link>
          <h1>{student.student.displayName}</h1>
        </div>
        <div />
        <button className="logout-button" onClick={logOut} type="button">
          Log out
        </button>
      </header>

      <nav className="section-tabs" aria-label="Section">
        {SECTIONS.map((entry) => (
          <button
            className={section === entry.key ? "active" : ""}
            key={entry.key}
            onClick={() => setSection(entry.key)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="section-stage">
        {section === "overview" ? <OverviewSection student={student} /> : null}
        {section === "speaking" ? <SpeakingSection student={student} /> : null}
        {section === "writing" ? <WritingSection student={student} /> : null}
        {section === "rewards" ? <RewardsSection student={student} /> : null}
        {section === "settings" ? <SettingsSection student={student} /> : null}
      </div>
    </main>
  );
}

/* ---------- Overview ---------- */
function OverviewSection({ student }: { student: StudentDashboard }) {
  const totalSessions = student.lessonHistory.length;
  const latestScore = student.evaluationSnapshots.at(-1)?.overallScore ?? student.lessonHistory[0]?.score ?? null;
  const activeSkills = student.skillStates.length;
  const strongestSkill = [...student.skillStates].sort((a, b) => b.score - a.score)[0];

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    fetch("/api/parent/student-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.student.id })
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Summary request failed");
        }
        const data = (await response.json()) as { summary: string };
        if (!cancelled) {
          setSummary(data.summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [student.student.id]);

  return (
    <section className="overview-section">
      <div className="development-assessment">
        <p className="tiny-label">AI Development Assessment</p>
        {summaryLoading ? (
          <p className="assessment-loading">{student.student.displayName} 학생의 학습 흐름을 정리하는 중입니다…</p>
        ) : summary ? (
          <p className="assessment-body">{summary}</p>
        ) : (
          <p className="assessment-loading">평가를 불러오지 못했습니다. 잠시 후 다시 열어 보세요.</p>
        )}
      </div>

      <div className="overview-stats">
        <div className="stat-card">
          <p className="tiny-label">Sessions</p>
          <strong>{totalSessions}</strong>
        </div>
        <div className="stat-card">
          <p className="tiny-label">Latest score</p>
          <strong>{latestScore ?? "—"}</strong>
        </div>
        <div className="stat-card">
          <p className="tiny-label">Active rewards</p>
          <strong>{student.rewardRules.length}</strong>
        </div>
        <div className="stat-card">
          <p className="tiny-label">Skills tracked</p>
          <strong>{activeSkills}</strong>
        </div>
      </div>

      <div className="quest-board overview-panel">
        <ScoreHistory
          points={student.progressPoints}
          title="점수 변화 히스토리"
          caption="Speaking · Writing · Confidence 점수의 일자별 흐름입니다."
        />
      </div>

      <div className="quest-board overview-panel">
        <h3>스킬 상태</h3>
        {student.skillStates.length === 0 ? (
          <p className="empty-note">스킬 데이터가 누적되면 여기에 표시됩니다.</p>
        ) : (
          <ul className="skill-grid">
            {student.skillStates.map((skill) => (
              <li key={skill.id}>
                <div className="skill-list-head">
                  <strong>{skill.skill}</strong>
                  <span>{skill.score}/100 · {skill.level}</span>
                </div>
                <div className="meter">
                  <i style={{ width: `${skill.score}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="quest-board overview-panel">
        <h3>활동 기록</h3>
        {student.lessonHistory.length === 0 ? (
          <p className="empty-note">아직 기록된 세션이 없습니다.</p>
        ) : (
          <ul className="activity-log">
            {student.lessonHistory.slice(0, 12).map((item) => (
              <li key={item.id}>
                <span className={`activity-mode-tag ${item.mode}`}>
                  {item.mode === "speaking" ? "Speaking" : "Writing"}
                </span>
                <div className="activity-body">
                  <strong>{item.prompt ?? item.title}</strong>
                </div>
                <span className="activity-log-meta">
                  {item.date} · {item.score}점
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {strongestSkill ? (
        <div className="overview-callout">
          <p className="tiny-label">Strongest skill right now</p>
          <strong>
            {strongestSkill.skill} · {strongestSkill.score}/100
          </strong>
          {strongestSkill.signals.length > 0 ? (
            <p>{strongestSkill.signals[0]}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* ---------- Speaking ---------- */
function SpeakingSection({ student }: { student: StudentDashboard }) {
  const sessions = useMemo(() => groupSpeakingByDate(student.speakingAttempts), [student.speakingAttempts]);
  const [openId, setOpenId] = useState<string | null>(sessions[0]?.id ?? null);

  if (sessions.length === 0) {
    return (
      <section className="quest-board">
        <p className="empty-note">아직 Speaking 세션이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="log-section">
      {sessions.map((session) => (
        <SessionRowCard
          key={session.id}
          session={session}
          isOpen={openId === session.id}
          onToggle={() => setOpenId(openId === session.id ? null : session.id)}
        >
          {session.attempts.map((attempt, index) => (
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

function SpeakingAttemptCard({
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
        <p className="tiny-label">학생 답변</p>
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
          <p className="tiny-label">제시된 더 좋은 문장</p>
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

type SessionRow<TAttempt> = {
  id: string;
  date: string;
  topic: string;
  attempts: TAttempt[];
  initialScore: number;
  finalScore: number;
  bestScore: number;
  delta: number;
};

function SessionRowCard<TAttempt>({
  session,
  isOpen,
  onToggle,
  children
}: {
  session: SessionRow<TAttempt>;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
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
            ▾
          </span>
        </div>
      </button>
      {isOpen ? <div className="log-card-body">{children}</div> : null}
    </article>
  );
}

function formatSessionDate(date: string): string {
  // "2026-05-24" → "2026.05.24"
  return date.replace(/-/g, ".");
}

function groupSpeakingByDate(attempts: SpeakingAttempt[]): SessionRow<SpeakingAttempt>[] {
  // attempts arrive newest-first from dashboard. Group by date+topic, then
  // reverse within each group so the body lists Try 1 → Try N oldest-first.
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

/* ---------- Writing ---------- */
type WritingAttempt = LessonHistoryItem & { snapshot?: EvaluationSnapshot };

function WritingSection({ student }: { student: StudentDashboard }) {
  const sessions = useMemo(
    () => groupWritingByDate(student.lessonHistory, student.evaluationSnapshots),
    [student.lessonHistory, student.evaluationSnapshots]
  );
  const [openId, setOpenId] = useState<string | null>(sessions[0]?.id ?? null);

  if (sessions.length === 0) {
    return (
      <section className="quest-board">
        <p className="empty-note">아직 Writing 세션이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="log-section">
      {sessions.map((session) => (
        <SessionRowCard
          key={session.id}
          session={session}
          isOpen={openId === session.id}
          onToggle={() => setOpenId(openId === session.id ? null : session.id)}
        >
          {session.attempts.map((attempt, index) => (
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

function WritingAttemptCard({
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
          <p className="tiny-label">학생의 글</p>
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

function groupWritingByDate(
  history: LessonHistoryItem[],
  snapshots: EvaluationSnapshot[]
): SessionRow<WritingAttempt>[] {
  const writingHistory = history.filter((item) => item.mode === "writing");
  const writingSnapshots = snapshots.filter((s) => s.mode === "writing");

  // Pair by index (both arrays arrive newest-first from the dashboard, with
  // one snapshot inserted per learning_event in /api/learning-events).
  const paired: WritingAttempt[] = writingHistory.map((item, i) => ({
    ...item,
    snapshot: writingSnapshots[i]
  }));

  // Group by date + prompt (prompt missing → date alone).
  const map = new Map<string, WritingAttempt[]>();
  for (const attempt of paired) {
    const key = `${attempt.date}::${attempt.prompt ?? attempt.title}`;
    const list = map.get(key) ?? [];
    list.push(attempt);
    map.set(key, list);
  }

  const rows: SessionRow<WritingAttempt>[] = [];
  for (const [key, group] of map.entries()) {
    const ordered = [...group].reverse(); // oldest first → Draft 1, Rewrite 1, ...
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

/* ---------- Rewards ---------- */
function RewardsSection({ student }: { student: StudentDashboard }) {
  const [rules, setRules] = useState<RewardRule[]>(student.rewardRules);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<RewardRule["triggerType"]>("attendance_count");
  const [targetValue, setTargetValue] = useState("");
  const [rewardItem, setRewardItem] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle("");
    setDescription("");
    setTriggerType("attendance_count");
    setTargetValue("");
    setRewardItem("");
  }

  async function handleAddRule() {
    if (!title.trim() || !targetValue || !rewardItem.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const currentValue =
        triggerType === "attendance_count"
          ? student.lessonHistory.length
          : student.evaluationSnapshots.at(-1)?.overallScore ?? 0;

      const response = await fetch("/api/reward-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.student.id,
          title: title.trim(),
          description: description.trim(),
          triggerType,
          targetValue: Number(targetValue),
          currentValue,
          rewardItem: rewardItem.trim()
        })
      });

      const saved: RewardRule = response.ok
        ? await response.json()
        : {
            id: `rule-local-${Date.now()}`,
            title: title.trim(),
            description: description.trim(),
            triggerType,
            targetValue: Number(targetValue),
            currentValue,
            rewardItem: rewardItem.trim(),
            status: "active"
          };

      setRules((current) => [saved, ...current]);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rewards-section">
      <div className="quest-board overview-panel">
        <h3>등록된 리워드</h3>
        {rules.length === 0 ? (
          <p className="empty-note">아직 등록된 리워드가 없습니다.</p>
        ) : (
          <ul className="reward-rule-cards">
            {rules.map((rule) => {
              const progress = Math.min(100, Math.round((rule.currentValue / rule.targetValue) * 100));
              return (
                <li key={rule.id}>
                  <div className="reward-rule-card-head">
                    <div>
                      <strong>{rule.title}</strong>
                      {rule.description ? <span className="rule-description">{rule.description}</span> : null}
                    </div>
                    <span className="reward-item-pill">🎁 {rule.rewardItem}</span>
                  </div>
                  <div className="reward-rule-card-stats">
                    <span>
                      {rule.triggerType === "attendance_count" ? "출석 성실도" : "종합 점수"}
                    </span>
                    <span>
                      현재 {rule.currentValue} / 목표 {rule.targetValue}
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
      </div>

      <div className="quest-board reward-form-panel">
        <div>
          <p className="tiny-label">New reward</p>
          <h3>새 리워드 추가</h3>
        </div>
        <div className="reward-form">
          <label>
            <span>리워드 제목</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예) 매일 출석 보너스"
            />
          </label>
          <label>
            <span>목적</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="예) 매일 학습 습관 유지를 응원"
            />
          </label>
          <div className="reward-form-row">
            <label>
              <span>종류</span>
              <select
                value={triggerType}
                onChange={(event) => setTriggerType(event.target.value as RewardRule["triggerType"])}
              >
                <option value="attendance_count">출석 성실도 (수업 횟수)</option>
                <option value="score_growth">종합 점수</option>
              </select>
            </label>
            <label>
              <span>목표 달성 수치</span>
              <input
                type="number"
                min="1"
                value={targetValue}
                onChange={(event) => setTargetValue(event.target.value)}
                placeholder={triggerType === "attendance_count" ? "회" : "점"}
              />
            </label>
            <label>
              <span>보상 항목</span>
              <input
                value={rewardItem}
                onChange={(event) => setRewardItem(event.target.value)}
                placeholder="예) 레고 닌자고 세트"
              />
            </label>
          </div>
          <button
            className="quest-submit reward-form-submit"
            onClick={handleAddRule}
            type="button"
            disabled={submitting || !title.trim() || !targetValue || !rewardItem.trim()}
          >
            {submitting ? "추가 중…" : "리워드 추가"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Settings ---------- */
function SettingsSection({ student }: { student: StudentDashboard }) {
  const [usGradeLevel, setUsGradeLevel] = useState(student.student.usGradeLevel);
  const [levelDescription, setLevelDescription] = useState(student.student.levelDescription);

  return (
    <section className="quest-board settings-panel-wrapper">
      <div className="quest-title-row">
        <div>
          <p className="tiny-label">Settings</p>
          <h2>{student.student.displayName}의 학습 수준</h2>
        </div>
      </div>
      <div className="settings-grid">
        <label>
          <span>US grade level</span>
          <input value={usGradeLevel} onChange={(event) => setUsGradeLevel(event.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <input
            value={levelDescription}
            onChange={(event) => setLevelDescription(event.target.value)}
          />
        </label>
      </div>
      <p className="settings-note">
        지금은 입력만 받으며, 저장 API는 별건으로 연결됩니다. 자녀별 레벨이 학습 과제 생성에 반영됩니다.
      </p>
    </section>
  );
}
