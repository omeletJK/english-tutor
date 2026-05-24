"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ProgressPoint } from "@/lib/types";

type ScoreHistoryProps = {
  points: ProgressPoint[];
  title?: string;
  caption?: string;
};

type SeriesKey = "speaking" | "writing" | "confidence";

const SERIES: Array<{ key: SeriesKey; label: string; color: string }> = [
  { key: "speaking", label: "Speaking", color: "var(--ink)" },
  { key: "writing", label: "Writing", color: "var(--accent)" },
  { key: "confidence", label: "Confidence", color: "var(--moss)" }
];

const BAR_WIDTH = 26;
const BAR_GAP = 16;
const STEP = BAR_WIDTH + BAR_GAP;
const PADDING_X = { left: 44, right: 24 };
const CHART_HEIGHT = 150;
const PADDING_Y = { top: 22, bottom: 10 };
const INNER_HEIGHT = CHART_HEIGHT - PADDING_Y.top - PADDING_Y.bottom;
const Y_TICKS = [0, 25, 50, 75, 100];

export function ScoreHistory({ points, title = "Score history", caption }: ScoreHistoryProps) {
  const ordered = useMemo(() => [...points].sort(byDate), [points]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useDragScroll(scrollerRef);
  useScrollToEnd(scrollerRef, ordered.length);

  if (ordered.length === 0) {
    return (
      <div className="score-history">
        <div className="score-history-head">
          <p className="tiny-label">Trend</p>
          <h3>{title}</h3>
        </div>
        <p className="empty-note">아직 기록된 점수가 없습니다.</p>
      </div>
    );
  }

  const N = ordered.length;
  const contentWidth = PADDING_X.left + N * STEP + PADDING_X.right;
  const xAt = (i: number) => PADDING_X.left + i * STEP + BAR_WIDTH / 2;
  const yBaseline = PADDING_Y.top + INNER_HEIGHT;
  const yForScore = (score: number) =>
    PADDING_Y.top + (1 - clampScore(score) / 100) * INNER_HEIGHT;

  const latest = ordered[N - 1];
  const first = ordered[0];

  return (
    <div className="score-history">
      <div className="score-history-head">
        <div>
          <p className="tiny-label">Trend</p>
          <h3>{title}</h3>
        </div>
        <div className="score-history-legend" role="list">
          {SERIES.map((series) => (
            <span key={series.key} role="listitem">
              <i style={{ background: series.color }} />
              {series.label}
            </span>
          ))}
        </div>
      </div>

      <div className="score-history-scroller" ref={scrollerRef} aria-label="점수 변화 그래프, 좌우로 드래그해서 과거 데이터를 볼 수 있습니다">
        <div className="score-history-stack" style={{ minWidth: contentWidth }}>
          {SERIES.map((series) => (
            <div className="metric-chart" key={series.key}>
              <div className="metric-chart-tag" style={{ color: series.color, borderColor: series.color }}>
                <i style={{ background: series.color }} aria-hidden="true" />
                {series.label}
              </div>
              <svg
                role="img"
                aria-label={`${series.label} 막대 그래프`}
                width={contentWidth}
                height={CHART_HEIGHT}
                style={{ display: "block" }}
              >
                {Y_TICKS.map((tick) => {
                  const y = yForScore(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={PADDING_X.left - 6}
                        x2={contentWidth - 6}
                        y1={y}
                        y2={y}
                        stroke="var(--line)"
                        strokeWidth={1}
                        strokeDasharray={tick === 0 ? undefined : "2 4"}
                      />
                      <text
                        x={PADDING_X.left - 10}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="10"
                        fill="var(--ink-faint)"
                      >
                        {tick}
                      </text>
                    </g>
                  );
                })}

                {ordered.map((point, index) => {
                  const value = clampScore(point[series.key]);
                  const y = yForScore(value);
                  const height = Math.max(yBaseline - y, 2);
                  return (
                    <g key={point.date}>
                      <rect
                        x={xAt(index) - BAR_WIDTH / 2}
                        y={y}
                        width={BAR_WIDTH}
                        height={height}
                        rx={4}
                        fill={series.color}
                        opacity={0.92}
                      >
                        <title>{`${series.label} · ${point.date} · ${value}`}</title>
                      </rect>
                      <text
                        x={xAt(index)}
                        y={y - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="600"
                        fill="var(--ink)"
                      >
                        {value}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ))}

          <div className="metric-chart-dates" style={{ width: contentWidth, height: 26 }}>
            {ordered.map((point, index) => (
              <span
                key={point.date}
                className="metric-chart-date-tick"
                style={{ left: xAt(index) }}
              >
                {formatTickDate(point.date)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="score-history-hint">
        ← 끌어서 과거 기록을 볼 수 있어요 →
      </p>

      <div className="score-history-table-wrap">
        <table className="score-history-table">
          <thead>
            <tr>
              <th scope="col">날짜</th>
              {SERIES.map((series) => (
                <th key={series.key} scope="col">
                  <span className="th-swatch" style={{ background: series.color }} aria-hidden="true" />
                  {series.label}
                </th>
              ))}
              <th scope="col">평균</th>
            </tr>
          </thead>
          <tbody>
            {[...ordered].reverse().map((point, reverseIndex) => {
              const index = ordered.length - 1 - reverseIndex;
              const previous = index > 0 ? ordered[index - 1] : null;
              const avg = Math.round((point.speaking + point.writing + point.confidence) / 3);
              return (
                <tr key={point.date}>
                  <th scope="row">{formatRowDate(point.date)}</th>
                  {SERIES.map((series) => (
                    <td key={series.key}>
                      <span className="score-value">{clampScore(point[series.key])}</span>
                      {previous ? <DeltaBadge delta={point[series.key] - previous[series.key]} /> : null}
                    </td>
                  ))}
                  <td>
                    <strong>{avg}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {caption ? <p className="score-history-caption">{caption}</p> : null}

      {N > 1 ? (
        <div className="score-history-summary">
          {SERIES.map((series) => {
            const diff = latest[series.key] - first[series.key];
            return (
              <div key={series.key} className="score-history-summary-item">
                <span className="tiny-label">{series.label}</span>
                <strong>
                  {first[series.key]} → {latest[series.key]}
                </strong>
                <DeltaBadge delta={diff} />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="delta-badge neutral">±0</span>;
  }
  const positive = delta > 0;
  return (
    <span className={`delta-badge ${positive ? "positive" : "negative"}`}>
      {positive ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

function useDragScroll(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let moved = false;

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      if (event.button !== 0) return;
      isDown = true;
      moved = false;
      startX = event.clientX;
      scrollStart = el!.scrollLeft;
    }

    function onPointerMove(event: PointerEvent) {
      if (!isDown || !el) return;
      const dx = event.clientX - startX;
      if (!moved && Math.abs(dx) > 3) {
        moved = true;
        el.classList.add("dragging");
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          /* no-op */
        }
      }
      if (moved) {
        el.scrollLeft = scrollStart - dx;
        event.preventDefault();
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (!isDown || !el) return;
      isDown = false;
      moved = false;
      el.classList.remove("dragging");
      try {
        if (el.hasPointerCapture(event.pointerId)) {
          el.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* no-op */
      }
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("pointerleave", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("pointerleave", onPointerUp);
    };
  }, [ref]);
}

function useScrollToEnd(ref: React.RefObject<HTMLDivElement | null>, count: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [ref, count]);
}

function clampScore(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function byDate(a: ProgressPoint, b: ProgressPoint) {
  return a.date.localeCompare(b.date);
}

function formatTickDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match) {
    return `${match[2]}/${match[3]}`;
  }
  return date;
}

function formatRowDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match) {
    return `${match[1]}.${match[2]}.${match[3]}`;
  }
  return date;
}
