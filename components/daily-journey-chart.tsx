"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type HoverState = {
  date: string;
  anchorTop: number;
  anchorLeft: number;
  scores: number[];
  final: number;
  best: number;
};

/* ---------------------------------------------------------------- *
 * Per-day bar chart with the day's try-journey overlaid inside
 * each bar. The bar height = that day's BEST score (highest of all
 * attempts). Thin horizontal ticks inside the bar trace each
 * non-best attempt, so the kid sees both the trend across days AND
 * the grind inside a single day in one glance.
 * ---------------------------------------------------------------- */

export type DailyTry = { date: string; score: number };

const COL_WIDTH = 76;
const BAR_WIDTH = 44;
const PADDING_X = { left: 52, right: 24 };
const CHART_HEIGHT = 260;
const PADDING_Y = { top: 34, bottom: 52 };
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
  const [hover, setHover] = useState<HoverState | null>(null);
  useScrollToEnd(scrollerRef, days.length);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const clear = () => setHover(null);
    el.addEventListener("scroll", clear);
    return () => el.removeEventListener("scroll", clear);
  }, []);

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
  const diff = latest.best - first.best;
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
            <span style={{ color: "var(--ink-soft)", fontSize: "1.05rem" }}>
              {first.best} → {latest.best}
            </span>
            <span style={{ color: diffTone, fontWeight: 600, fontSize: "1.05rem" }}>
              {diffSign}
            </span>
          </div>
        ) : (
          <span style={{ color: "var(--ink-soft)", fontSize: "1.05rem" }}>
            첫 기록 {latest.best}점
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
                    y={y + 5}
                    textAnchor="end"
                    fontSize="14"
                    fontWeight="500"
                    fill="var(--ink-soft)"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {days.map((day, i) => {
              const cx = xCenter(i);
              const bestY = yForScore(day.best);
              const barX = cx - BAR_WIDTH / 2;
              const barHeight = Math.max(baseY - bestY, 2);
              const tickX1 = barX + 2;
              const tickX2 = barX + BAR_WIDTH - 2;
              const isHovered = hover?.date === day.date;
              let bestSkipped = false;
              const otherScores = day.scores.filter((s) => {
                if (s === day.best && !bestSkipped) {
                  bestSkipped = true;
                  return false;
                }
                return true;
              });

              function showTooltip(event: React.MouseEvent<SVGRectElement>) {
                setHover({
                  date: day.date,
                  anchorTop: event.clientY,
                  anchorLeft: event.clientX,
                  scores: day.scores,
                  final: day.final,
                  best: day.best
                });
              }

              function hideTooltip() {
                setHover((current) => (current?.date === day.date ? null : current));
              }

              return (
                <g key={day.date}>
                  <rect
                    x={barX}
                    y={bestY}
                    width={BAR_WIDTH}
                    height={barHeight}
                    rx={6}
                    fill="var(--accent)"
                    opacity={isHovered ? 0.28 : 0.16}
                  >
                    <title>{`${formatTooltipDate(day.date)} · 최고 ${day.best}점 · 최종 ${day.final}점 · ${day.scores.length}회 시도`}</title>
                  </rect>

                  {otherScores.map((s, idx) => (
                    <line
                      key={`try-${idx}`}
                      x1={tickX1}
                      x2={tickX2}
                      y1={yForScore(s)}
                      y2={yForScore(s)}
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                      opacity={0.55}
                      pointerEvents="none"
                    />
                  ))}

                  <text
                    x={cx}
                    y={bestY - 10}
                    textAnchor="middle"
                    fontSize="17"
                    fontWeight="700"
                    fill="var(--ink)"
                    pointerEvents="none"
                  >
                    {day.best}
                  </text>

                  {day.scores.length > 1 ? (
                    <text
                      x={cx}
                      y={baseY + 20}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="500"
                      fill="var(--ink-soft)"
                      pointerEvents="none"
                    >
                      {day.scores.length}회
                    </text>
                  ) : null}

                  <rect
                    x={barX - 6}
                    y={PADDING_Y.top}
                    width={BAR_WIDTH + 12}
                    height={baseY - PADDING_Y.top}
                    fill="transparent"
                    onMouseEnter={showTooltip}
                    onMouseMove={showTooltip}
                    onMouseLeave={hideTooltip}
                    style={{ cursor: "help" }}
                  />
                </g>
              );
            })}

            {days.map((day, i) => (
              <text
                key={`${day.date}-label`}
                x={xCenter(i)}
                y={CHART_HEIGHT - 8}
                textAnchor="middle"
                fontSize="15"
                fontWeight="500"
                fill="var(--ink)"
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

      {hover ? <JourneyTooltip hover={hover} /> : null}
    </div>
  );
}

function JourneyTooltip({ hover }: { hover: HoverState }) {
  return (
    <div
      className="daily-journey-tooltip"
      style={{ top: hover.anchorTop - 16, left: hover.anchorLeft }}
      role="tooltip"
    >
      <div className="daily-journey-tooltip__head">
        <strong>{formatTooltipDate(hover.date)}</strong>
        <span>{hover.scores.length}회 시도</span>
      </div>
      <ol className="daily-journey-tooltip__list">
        {hover.scores.map((score, idx) => {
          const prev = idx > 0 ? hover.scores[idx - 1] : null;
          const delta = prev !== null ? score - prev : 0;
          const isFinal = idx === hover.scores.length - 1;
          const isBest = score === hover.best;
          return (
            <li
              key={idx}
              className={`${isFinal ? "final" : ""} ${isBest ? "best" : ""}`.trim()}
            >
              <span className="try-label">Try {idx + 1}</span>
              <strong>{score}</strong>
              {prev !== null ? (
                <span className={`delta ${delta > 0 ? "up" : delta < 0 ? "down" : "same"}`}>
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
              ) : null}
              {isFinal ? <span className="tag final-tag">최종</span> : null}
              {isBest && !isFinal ? <span className="tag best-tag">최고</span> : null}
            </li>
          );
        })}
      </ol>
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

  // Dashboard returns attempts in created_at DESC order. Sorting by date
  // string alone does NOT reorder same-date items, so a stable sort on the
  // newest-first input still leaves each day's scores in newest-first
  // order — which would make scores[last] the OLDEST try, breaking
  // `final = scores[last]`.
  //
  // Reverse first to get oldest-first overall; then group preserves the
  // intra-day chronology.
  const oldestFirst = [...tries].reverse();

  const map = new Map<string, number[]>();
  for (const t of oldestFirst) {
    const list = map.get(t.date) ?? [];
    list.push(t.score);
    map.set(t.date, list);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, scores]) => ({
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
