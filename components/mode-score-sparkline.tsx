"use client";

import { useMemo } from "react";
import type { EvaluationSnapshot, TaskMode } from "@/lib/types";

/* ---------------------------------------------------------------- *
 * Single-mode mini chart for the Writing / Speaking tab header.
 * Shows the score arc for that mode only, latest first → oldest
 * left-to-right, with the most recent score callout.
 * ---------------------------------------------------------------- */

const WIDTH = 320;
const HEIGHT = 80;
const PADDING_X = 10;
const PADDING_Y = 14;

export function ModeScoreSparkline({
  snapshots,
  mode,
  label
}: {
  snapshots: EvaluationSnapshot[];
  mode: TaskMode;
  label: string;
}) {
  const points = useMemo(() => {
    // snapshots arrive newest-first → reverse to oldest-first for chart
    return [...snapshots].filter((s) => s.mode === mode).reverse();
  }, [snapshots, mode]);

  if (points.length === 0) {
    return (
      <div className="mode-sparkline empty" style={emptyStyles}>
        <span className="tiny-label">{label}</span>
        <span style={{ color: "var(--ink-faint)", fontSize: "0.85rem" }}>
          아직 점수 기록이 없어요. 오늘부터 시작해 보세요.
        </span>
      </div>
    );
  }

  const latest = points[points.length - 1];
  const first = points[0];
  const lift = latest.overallScore - first.overallScore;
  const liftTone =
    lift > 0 ? "var(--moss)" : lift < 0 ? "var(--accent)" : "var(--ink-soft)";

  const innerWidth = WIDTH - PADDING_X * 2;
  const innerHeight = HEIGHT - PADDING_Y * 2;
  const xStep = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const xAt = (i: number) =>
    points.length === 1 ? PADDING_X + innerWidth / 2 : PADDING_X + i * xStep;
  const yAt = (value: number) =>
    PADDING_Y + innerHeight - (clamp(value) / 100) * innerHeight;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.overallScore).toFixed(1)}`)
    .join(" ");

  return (
    <div className="mode-sparkline" style={containerStyles}>
      <div style={headerRowStyles}>
        <div>
          <p className="tiny-label" style={{ marginBottom: 2 }}>
            {label}
          </p>
          <strong style={{ fontSize: "1.65rem", fontVariantNumeric: "tabular-nums" }}>
            {latest.overallScore}
            <span style={{ color: "var(--ink-faint)", fontSize: "0.9rem", marginLeft: 6 }}>
              / 100
            </span>
          </strong>
        </div>
        {points.length > 1 ? (
          <div style={{ textAlign: "right" }}>
            <p className="tiny-label" style={{ marginBottom: 2 }}>
              {points.length}회 평가
            </p>
            <span style={{ color: liftTone, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {first.overallScore} → {latest.overallScore}{" "}
              <span style={{ marginLeft: 4 }}>
                {lift > 0 ? `+${lift}` : lift}
              </span>
            </span>
          </div>
        ) : (
          <div style={{ textAlign: "right" }}>
            <p className="tiny-label" style={{ marginBottom: 2 }}>
              첫 평가
            </p>
            <span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>
              계속 도전해 보세요
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: HEIGHT, marginTop: 8 }}
        aria-hidden="true"
      >
        {[0, 50, 100].map((tick) => (
          <line
            key={tick}
            x1={PADDING_X}
            x2={WIDTH - PADDING_X}
            y1={yAt(tick)}
            y2={yAt(tick)}
            stroke="var(--line-soft)"
            strokeWidth={0.5}
          />
        ))}
        {points.length > 1 ? (
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={xAt(i)}
            cy={yAt(p.overallScore)}
            r={i === points.length - 1 ? 3.5 : 2.25}
            fill={i === points.length - 1 ? "var(--accent)" : "var(--surface)"}
            stroke="var(--accent)"
            strokeWidth={1.25}
          />
        ))}
      </svg>
    </div>
  );
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

const containerStyles: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 14,
  padding: 16
};

const emptyStyles: React.CSSProperties = {
  ...containerStyles,
  display: "flex",
  flexDirection: "column",
  gap: 6
};

const headerRowStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16
};
