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

      <div className="overview-row">
        <div className="quest-board overview-panel">
          <h3>최근 활동</h3>
          {student.lessonHistory.length === 0 ? (
            <p className="empty-note">아직 기록된 세션이 없습니다.</p>
          ) : (
            <ul className="activity-list">
              {student.lessonHistory.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <span className="activity-mode">{item.mode === "speaking" ? "Speaking" : "Writing"}</span>
                  <strong>{item.title}</strong>
                  <span className="activity-meta">
                    {item.date} · {item.score}점
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="quest-board overview-panel">
          <h3>스킬 상태</h3>
          {student.skillStates.length === 0 ? (
            <p className="empty-note">스킬 데이터가 누적되면 여기에 표시됩니다.</p>
          ) : (
            <ul className="skill-list">
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
  const grouped = useMemo(() => groupAttemptsByTopic(student.speakingAttempts), [student.speakingAttempts]);
  const [openTopic, setOpenTopic] = useState<string | null>(grouped[0]?.topic ?? null);

  if (grouped.length === 0) {
    return (
      <section className="quest-board">
        <p className="empty-note">아직 Speaking 세션이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="log-section">
      {grouped.map((group) => {
        const isOpen = openTopic === group.topic;
        const first = group.attempts[group.attempts.length - 1];
        const latest = group.attempts[0];
        const lift = latest.score - first.score;

        return (
          <article className={`log-card ${isOpen ? "open" : ""}`} key={group.topic}>
            <button
              className="log-card-head"
              onClick={() => setOpenTopic(isOpen ? null : group.topic)}
              type="button"
            >
              <div className="log-card-title">
                <p className="tiny-label">Topic</p>
                <strong>{group.topic}</strong>
              </div>
              <div className="log-card-stats">
                <span>
                  {group.attempts.length}회 시도
                </span>
                <span className={lift >= 0 ? "lift positive" : "lift negative"}>
                  {first.score} → {latest.score} {lift >= 0 ? `+${lift}` : lift}
                </span>
              </div>
            </button>
            {isOpen ? (
              <div className="log-card-body">
                {group.attempts.map((attempt, index) => (
                  <SpeakingAttemptCard
                    attempt={attempt}
                    attemptIndex={group.attempts.length - index}
                    key={attempt.id}
                  />
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function SpeakingAttemptCard({ attempt, attemptIndex }: { attempt: SpeakingAttempt; attemptIndex: number }) {
  return (
    <div className="attempt-card">
      <div className="attempt-head">
        <div>
          <p className="tiny-label">Try {attemptIndex}</p>
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

function groupAttemptsByTopic(attempts: SpeakingAttempt[]) {
  const map = new Map<string, SpeakingAttempt[]>();
  for (const attempt of attempts) {
    const list = map.get(attempt.topic) ?? [];
    list.push(attempt);
    map.set(attempt.topic, list);
  }
  return Array.from(map.entries()).map(([topic, group]) => ({
    topic,
    attempts: group
  }));
}

/* ---------- Writing ---------- */
function WritingSection({ student }: { student: StudentDashboard }) {
  const writingSessions = useMemo(
    () => buildWritingSessions(student.lessonHistory, student.evaluationSnapshots),
    [student.lessonHistory, student.evaluationSnapshots]
  );
  const [openSessionId, setOpenSessionId] = useState<string | null>(writingSessions[0]?.id ?? null);

  if (writingSessions.length === 0) {
    return (
      <section className="quest-board">
        <p className="empty-note">아직 Writing 세션이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="log-section">
      {writingSessions.map((session) => {
        const isOpen = openSessionId === session.id;
        return (
          <article className={`log-card ${isOpen ? "open" : ""}`} key={session.id}>
            <button
              className="log-card-head"
              onClick={() => setOpenSessionId(isOpen ? null : session.id)}
              type="button"
            >
              <div className="log-card-title">
                <p className="tiny-label">{session.date}</p>
                <strong>{session.title}</strong>
              </div>
              <div className="log-card-stats">
                <span className="attempt-score">{session.score}점</span>
              </div>
            </button>
            {isOpen ? (
              <div className="log-card-body">
                <div className="attempt-card">
                  {session.prompt ? (
                    <div className="attempt-transcript">
                      <p className="tiny-label">받은 질문</p>
                      <p>{session.prompt}</p>
                    </div>
                  ) : null}
                  {session.rawInput ? (
                    <div className="attempt-transcript">
                      <p className="tiny-label">학생의 글</p>
                      <p>{session.rawInput}</p>
                    </div>
                  ) : null}
                  {session.snapshot ? (
                    <>
                      {session.snapshot.metrics.length > 0 ? (
                        <div className="metric-chips">
                          {session.snapshot.metrics.map((metric) => (
                            <span key={metric.label}>
                              {metric.label} {metric.score}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {session.snapshot.strengths.length > 0 ? (
                        <div className="attempt-references">
                          <p className="tiny-label">잘한 점</p>
                          {session.snapshot.strengths.map((item) => (
                            <p key={item} className="strength-line">
                              {item}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {session.snapshot.needsPractice.length > 0 ? (
                        <div className="attempt-references">
                          <p className="tiny-label">더 연습할 점</p>
                          {session.snapshot.needsPractice.map((item) => (
                            <p key={item} className="practice-line">
                              {item}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function buildWritingSessions(history: LessonHistoryItem[], snapshots: EvaluationSnapshot[]) {
  const writingHistory = history.filter((item) => item.mode === "writing");
  const writingSnapshots = snapshots.filter((snapshot) => snapshot.mode === "writing");

  return writingHistory.map((item, index) => ({
    ...item,
    snapshot: writingSnapshots[writingSnapshots.length - 1 - index] ?? writingSnapshots.at(-1)
  }));
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
