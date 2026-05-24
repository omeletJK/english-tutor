"use client";

import Link from "next/link";
import { Notebook } from "@/components/illustrations";
import type { DashboardData, StudentDashboard } from "@/lib/types";

type ParentChildrenListProps = {
  initialData: DashboardData;
};

export function ParentChildrenList({ initialData }: ParentChildrenListProps) {
  const { currentUser, students } = initialData;

  async function logOut() {
    await fetch("/api/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <main className="game-shell">
      <header className="game-topbar">
        <div>
          <p className="tiny-label">Omelet English · Parent</p>
          <h1>{currentUser.displayName}</h1>
        </div>
        <div />
        <button className="logout-button" onClick={logOut} type="button">
          Log out
        </button>
      </header>

      <section className="children-board">
        <div className="children-board-head">
          <p className="tiny-label">Family</p>
          <h2>어떤 자녀의 학습을 보시겠어요?</h2>
          <p className="children-board-help">자녀 이름을 누르면 학습 일지, Speaking · Writing 세션, 리워드 설정을 볼 수 있습니다.</p>
        </div>

        <div className="children-grid">
          {students.map((entry) => (
            <ChildCard key={entry.student.id} entry={entry} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ChildCard({ entry }: { entry: StudentDashboard }) {
  const latestScore = entry.evaluationSnapshots.at(-1)?.overallScore ?? entry.lessonHistory[0]?.score ?? null;
  const sessionCount = entry.lessonHistory.length;
  const initial = entry.student.displayName.slice(0, 1);

  return (
    <Link href={`/parent/${entry.student.id}`} className="child-card">
      <div className="child-card-head">
        <span className="avatar-token">{initial}</span>
        <Notebook size={36} />
      </div>
      <div className="child-card-body">
        <strong>{entry.student.displayName}</strong>
        <span>{entry.student.usGradeLevel}</span>
      </div>
      <div className="child-card-stats">
        <div>
          <p className="tiny-label">Sessions</p>
          <strong>{sessionCount}</strong>
        </div>
        <div>
          <p className="tiny-label">Latest score</p>
          <strong>{latestScore ?? "—"}</strong>
        </div>
        <div>
          <p className="tiny-label">Rewards</p>
          <strong>{entry.rewardRules.length}</strong>
        </div>
      </div>
    </Link>
  );
}
