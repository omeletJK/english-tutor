"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  DashboardData,
  RewardRule,
  StudentDashboard
} from "@/lib/types";
import { DailyJourneyChart } from "@/components/daily-journey-chart";
import {
  SpeakingHistorySection,
  WritingHistorySection
} from "@/components/session-history";

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

  const speakingTries = useMemo(
    () => student.speakingAttempts.map((a) => ({ date: a.date, score: a.score })),
    [student.speakingAttempts]
  );
  const writingTries = useMemo(
    () =>
      student.evaluationSnapshots
        .filter((s) => s.mode === "writing")
        .map((s) => ({ date: s.date, score: s.overallScore })),
    [student.evaluationSnapshots]
  );

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
        <DailyJourneyChart
          tries={speakingTries}
          title="Speaking 일자별 점수 + 그날의 도전 흐름"
          caption="막대 높이는 그날의 마지막 점수. 막대 안의 가로선은 그날 시도했던 점수들이에요. (녹색은 최고 점수) 막대 위에 마우스를 올리면 Try별 점수가 보입니다."
        />
      </div>

      <div className="quest-board overview-panel">
        <DailyJourneyChart
          tries={writingTries}
          title="Writing 일자별 점수 + 그날의 도전 흐름"
          caption="막대 높이는 그날의 마지막 점수. 막대 안의 가로선은 그날 시도했던 점수들이에요. (녹색은 최고 점수) 막대 위에 마우스를 올리면 Try별 점수가 보입니다."
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
  return (
    <SpeakingHistorySection
      attempts={student.speakingAttempts}
      emptyMessage="아직 Speaking 세션이 없습니다."
    />
  );
}

/* ---------- Writing ---------- */
function WritingSection({ student }: { student: StudentDashboard }) {
  return (
    <WritingHistorySection
      lessonHistory={student.lessonHistory}
      evaluationSnapshots={student.evaluationSnapshots}
      emptyMessage="아직 Writing 세션이 없습니다."
    />
  );
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
