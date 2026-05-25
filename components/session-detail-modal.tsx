"use client";

import { useEffect } from "react";
import {
  SpeakingAttemptCard,
  WritingAttemptCard,
  type SpeakingSessionRow,
  type WritingSessionRow
} from "@/components/session-history";

/* ---------------------------------------------------------------- *
 * Full-detail popup for a single session row (one day, one prompt,
 * possibly multiple attempts). Triggered from the compact history
 * list — keeps the list scan-friendly while letting the detail
 * breathe in its own modal.
 * ---------------------------------------------------------------- */

type ModalProps =
  | { kind: "speaking"; session: SpeakingSessionRow; onClose: () => void }
  | { kind: "writing"; session: WritingSessionRow; onClose: () => void };

export function SessionDetailModal(props: ModalProps) {
  const { onClose, session } = props;

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 16, 8, 0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-modal-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          width: "min(1280px, 96vw)",
          maxHeight: "min(92vh, 1000px)",
          display: "flex",
          flexDirection: "column",
          boxShadow:
            "0 1px 2px rgba(20, 16, 8, 0.06), 0 24px 48px -20px rgba(20, 16, 8, 0.25)"
        }}
      >
        <header
          style={{
            padding: "20px 24px 14px",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex",
            alignItems: "flex-start",
            gap: 16
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="tiny-label" style={{ marginBottom: 6 }}>
              {session.date.replace(/-/g, ".")} ·{" "}
              {props.kind === "speaking" ? "Speaking" : "Writing"} · {session.attempts.length}
              번 시도
            </p>
            <h2 id="session-modal-title" style={{ margin: 0, lineHeight: 1.35 }}>
              {session.topic}
            </h2>
            {session.attempts.length > 1 ? (
              <p
                style={{
                  margin: "10px 0 0",
                  color: "var(--ink-soft)",
                  fontSize: "0.9rem"
                }}
              >
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {session.initialScore} → {session.finalScore}
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    color:
                      session.delta > 0
                        ? "var(--moss)"
                        : session.delta < 0
                          ? "var(--accent)"
                          : "var(--ink-soft)",
                    fontWeight: 600
                  }}
                >
                  {session.delta > 0 ? `+${session.delta}` : session.delta}
                </span>
                {session.bestScore !== session.finalScore ? (
                  <span style={{ marginLeft: 12, color: "var(--moss)" }}>
                    최고 {session.bestScore}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: "var(--sand)",
              border: "1px solid var(--line)",
              color: "var(--ink-soft)",
              cursor: "pointer",
              fontSize: "0.85rem"
            }}
          >
            닫기 ✕
          </button>
        </header>

        <div
          style={{
            padding: 24,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          {props.kind === "speaking"
            ? props.session.attempts.map((attempt, index) => (
                <SpeakingAttemptCard
                  key={attempt.id}
                  attempt={attempt}
                  attemptIndex={index + 1}
                  isBest={attempt.score === session.bestScore}
                />
              ))
            : props.session.attempts.map((attempt, index) => (
                <WritingAttemptCard
                  key={attempt.id}
                  attempt={attempt}
                  attemptIndex={index + 1}
                  isBest={attempt.score === session.bestScore}
                  prompt={session.topic}
                />
              ))}
        </div>
      </div>
    </div>
  );
}
