"use client";

import { useEffect, useMemo, useRef } from "react";

/* ---------------------------------------------------------------- *
 * Per-day bar chart with the day's try-journey overlaid inside
 * each bar. The bar height = that day's FINAL score. The dots and
 * thin connecting line trace 1차 → 2차 → … → final attempts on that
 * same day, so the kid sees both the trend across days AND the
 * grind inside a single day in one glance.
 * ---------------------------------------------------------------- */

export type DailyTry = { date: string; score: number };

const COL_WIDTH = 64;
const BAR_WIDTH = 36;
const PADDING_X = { left: 42, right: 20 };
const CHART_HEIGHT = 220;
const PADDING_Y = { top: 28, bottom: 38 };
const INNER_HEIGHT = CHART_HEIGHT - PADDING_Y.top - PADDING_Y.bottom;
const Y_TICKS = [0, 25, 50, 75, 100];

export function DailyJourneyChart({
  tries,
  title,
  caption
}: {
  tries: DailyTry[];
  title: string;
  caption?: string;
}) {
  const days = useMemo(() => groupByDate(tries), [tries]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  useScrollToEnd(scrollerRef, days.length);

  if (days.length === 0) {
    return (
      <div className="score-history">
        <div className="score-history-head">
          <p className="tiny-label">Trend</p>
          <h3>{title}</h3>
        </div>
        <p className="empty-note">아직 기록이 없어요. 오늘 탭에서 도전해 보세요.</p>
      </div>
    );
  }

  const contentWidth = PADDING_X.left + days.length * COL_WIDTH + PADDING_X.right;
  const baseY = yForScore(0);
  const xCenter = (i: number) => PADDING_X.left + i * COL_WIDTH + COL_WIDTH / 2;

  const first = days[0];
  const latest = days[days.length - 1];
  const diff = latest.final - first.final;
  const diffSign = diff > 0 ? `+${diff}` : `${diff}`;
  const diffTone = diff > 0 ? "var(--moss)" : diff < 0 ? "var(--accent)" : "var(--ink-soft)";

  return (
    <div className="score-history">
      <div className="score-history-head">
        <div>
          <p className="tiny-label">Trend</p>
          <h3>{title}</h3>
        </div>
        {days.length > 1 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            <span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>
              {first.final} → {latest.final}
            </span>
            <span style={{ color: diffTone, fontWeight: 600, fontSize: "0.85rem" }}>
              {diffSign}
            </span>
          </div>
        ) : (
          <span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>
            첫 기록 {latest.final}점
          </span>
        )}
      </div>

      <div
        className="score-history-scroller"
        ref={scrollerRef}
        aria-label="일자별 점수와 그날 시도 그래프, 좌우로 드래그해서 과거 데이터를 볼 수 있습니다"
      >
        <div className="score-history-stack" style={{ minWidth: contentWidth }}>
          <svg
            role="img"
            aria-label={title}
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

            {days.map((day, i) => {
              const cx = xCenter(i);
              const finalY = yForScore(day.final);
              const barX = cx - BAR_WIDTH / 2;
              const barHeight = Math.max(baseY - finalY, 2);
              const tickX1 = barX + 2;
              const tickX2 = barX + BAR_WIDTH - 2;

              return (
                <g key={day.date}>
                  <rect
                    x={barX}
                    y={finalY}
                    width={BAR_WIDTH}
                    height={barHeight}
                    rx={6}
                    fill="var(--accent)"
                    opacity={0.16}
                  >
                    <title>{`${formatTooltipDate(day.date)} · 최종 ${day.final}점 · ${day.scores.length}회 시도`}</title>
                  </rect>

                  {day.scores.length > 1
                    ? day.scores.slice(0, -1).map((s, idx) => {
                        const isBest = s === day.best;
                        return (
                          <line
                            key={`try-${idx}`}
                            x1={tickX1}
                            x2={tickX2}
                            y1={yForScore(s)}
                            y2={yForScore(s)}
                            stroke={isBest ? "var(--moss)" : "var(--accent)"}
                            strokeWidth={1.5}
                            opacity={isBest ? 0.9 : 0.55}
                          >
                            <title>{`Try ${idx + 1}: ${s}점${isBest ? " (최고)" : ""}`}</title>
                          </line>
                        );
                      })
                    : null}

                  <text
                    x={cx}
                    y={finalY - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--ink)"
                  >
                    {day.final}
                  </text>

                  {day.scores.length > 1 ? (
                    <text
                      x={cx}
                      y={baseY + 14}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--ink-faint)"
                    >
                      {day.scores.length}회
                    </text>
                  ) : null}
                </g>
              );
            })}

            {days.map((day, i) => (
              <text
                key={`${day.date}-label`}
                x={xCenter(i)}
                y={CHART_HEIGHT - 6}
                textAnchor="middle"
                fontSize="11"
                fill="var(--ink-soft)"
              >
                {formatTickDate(day.date)}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {days.length > 6 ? (
        <p className="score-history-hint">← 끌어서 과거 기록을 볼 수 있어요 →</p>
      ) : null}

      {caption ? <p className="score-history-caption">{caption}</p> : null}
    </div>
  );
}

type DayBucket = {
  date: string;
  scores: number[];
  final: number;
  best: number;
};

function groupByDate(tries: DailyTry[]): DayBucket[] {
  if (tries.length === 0) return [];

  // tries arrive newest-first from the dashboard, but date strings are
  // YYYY-MM-DD so a lex sort is also chronological. Push oldest first.
  const oldestFirst = [...tries].sort((a, b) => a.date.localeCompare(b.date));

  const map = new Map<string, number[]>();
  for (const t of oldestFirst) {
    const list = map.get(t.date) ?? [];
    list.push(t.score);
    map.set(t.date, list);
  }

  return Array.from(map.entries()).map(([date, scores]) => ({
    date,
    scores,
    final: scores[scores.length - 1],
    best: Math.max(...scores)
  }));
}

function yForScore(score: number) {
  return PADDING_Y.top + (1 - clamp(score) / 100) * INNER_HEIGHT;
}

function clamp(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function formatTickDate(iso: string) {
  // "2026-05-24" → "5/24"
  const [, mm, dd] = iso.split("-");
  return `${Number(mm)}/${Number(dd)}`;
}

function formatTooltipDate(iso: string) {
  const [yyyy, mm, dd] = iso.split("-");
  return `${yyyy}.${mm}.${dd}`;
}

function useScrollToEnd(ref: React.RefObject<HTMLDivElement | null>, dayCount: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth });
  }, [ref, dayCount]);
}
