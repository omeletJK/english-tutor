"use client";

import { useEffect, useMemo, useState } from "react";
import {
  avatarManifest,
  composedLayers,
  defaultAvatarSelection,
  imageUrl,
  loadAvatar,
  saveAvatar,
  type AvatarCategoryKey,
  type AvatarSelection
} from "@/lib/avatar";

const CANVAS_RATIO = avatarManifest.canvasHeight / avatarManifest.canvasWidth;

/* -------------------------------------------------------------------------- */
/* Composed avatar image (layered <img> stack)                                 */
/* -------------------------------------------------------------------------- */

type AvatarImageProps = {
  selection: AvatarSelection;
  size: number;
  /**
   * - "full": whole canvas, natural portrait (default for previews).
   * - "head": tight on the head, square output.
   * - "bust": head + torso, square output (good for profile cards).
   */
  crop?: "head" | "full" | "bust";
  className?: string;
};

export function AvatarImage({ selection, size, crop = "full", className }: AvatarImageProps) {
  const layers = composedLayers(selection);

  let wrapperStyle: React.CSSProperties;
  let stackStyle: React.CSSProperties;

  if (crop === "head") {
    wrapperStyle = { width: size, height: size, overflow: "hidden" };
    stackStyle = {
      position: "absolute",
      top: `-${size * 0.18}px`,
      left: `-${size * 0.12}px`,
      width: size * 1.25,
      height: size * 1.25 * CANVAS_RATIO
    };
  } else if (crop === "bust") {
    // Slight 5:6 portrait wrapper. Zoom the canvas in so the figure (which
    // only occupies ~42% of canvas width) fills more of the card. Pull the
    // stack further up so the figure's feet sit clearly inside the wrapper.
    const wrapperH = size * 1.2;
    wrapperStyle = { width: size, height: wrapperH, overflow: "hidden" };
    const stackW = size * 1.3;
    stackStyle = {
      position: "absolute",
      top: `-${size * 0.27}px`,
      left: `-${size * 0.15}px`,
      width: stackW,
      height: stackW * CANVAS_RATIO
    };
  } else {
    wrapperStyle = { width: size, height: size * CANVAS_RATIO };
    stackStyle = { position: "absolute", inset: 0 };
  }

  return (
    <div className={`avatar-image ${className ?? ""}`} style={{ position: "relative", ...wrapperStyle }}>
      <div style={stackStyle}>
        {layers.map((id) => (
          <img
            key={id}
            src={imageUrl(id)}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              userSelect: "none"
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Composer modal                                                              */
/* -------------------------------------------------------------------------- */

type AvatarComposerProps = {
  studentId: string;
  studentName: string;
  open: boolean;
  onClose: () => void;
  onSaved?: (selection: AvatarSelection) => void;
};

const CATEGORY_ORDER: AvatarCategoryKey[] = ["hair", "longHair", "eyes", "mouth", "top", "bottom"];

export function AvatarComposer({ studentId, studentName, open, onClose, onSaved }: AvatarComposerProps) {
  const [draft, setDraft] = useState<AvatarSelection>(defaultAvatarSelection);
  const [activeCategory, setActiveCategory] = useState<AvatarCategoryKey>("hair");

  useEffect(() => {
    if (open) {
      setDraft(loadAvatar(studentId));
      setActiveCategory("hair");
    }
  }, [open, studentId]);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const activeCategoryDef = useMemo(
    () => avatarManifest.categories[activeCategory],
    [activeCategory]
  );

  function pick(category: AvatarCategoryKey, itemId: string | null) {
    setDraft((current) => ({ ...current, [category]: itemId }));
  }

  function handleSave() {
    saveAvatar(studentId, draft);
    onSaved?.(draft);
    onClose();
  }

  function handleReset() {
    setDraft(defaultAvatarSelection);
  }

  if (!open) {
    return null;
  }

  return (
    <div className="avatar-composer-backdrop" onClick={onClose} role="presentation">
      <div
        className="avatar-composer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${studentName} 캐릭터 꾸미기`}
      >
        <header className="avatar-composer-head">
          <div>
            <p className="tiny-label">Character Studio</p>
            <h2>{studentName}의 캐릭터 꾸미기</h2>
          </div>
          <button className="avatar-composer-close" onClick={onClose} type="button" aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="avatar-composer-body">
          <aside className="avatar-composer-preview">
            <AvatarImage selection={draft} size={280} crop="full" />
          </aside>

          <section className="avatar-composer-controls">
            <nav className="avatar-category-tabs" aria-label="Category">
              {CATEGORY_ORDER.map((key) => (
                <button
                  className={activeCategory === key ? "active" : ""}
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  type="button"
                >
                  {avatarManifest.categories[key].label}
                </button>
              ))}
            </nav>

            <div className="avatar-options-grid">
              {activeCategoryDef.items.map((item) => {
                const isSelected = draft[activeCategory] === item.id;
                const previewSelection: AvatarSelection = { ...draft, [activeCategory]: item.id };
                return (
                  <button
                    type="button"
                    className={`avatar-option ${isSelected ? "selected" : ""}`}
                    key={item.id}
                    onClick={() => pick(activeCategory, item.id)}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <AvatarImage selection={previewSelection} size={88} crop="full" />
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="avatar-composer-foot">
          <button className="soft-button" onClick={handleReset} type="button">
            기본값으로 되돌리기
          </button>
          <button className="quest-submit avatar-save" onClick={handleSave} type="button">
            저장
          </button>
        </footer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar button (top-left trigger that opens the composer)                     */
/* -------------------------------------------------------------------------- */

type AvatarButtonProps = {
  studentId: string;
  studentName: string;
  size?: number;
  shape?: "circle" | "rounded";
  crop?: "head" | "bust" | "full";
};

export function AvatarButton({
  studentId,
  studentName,
  size = 56,
  shape = "circle",
  crop = "head"
}: AvatarButtonProps) {
  const [selection, setSelection] = useState<AvatarSelection>(defaultAvatarSelection);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    setSelection(loadAvatar(studentId));
  }, [studentId]);

  return (
    <>
      <button
        className={`avatar-button ${shape === "rounded" ? "rounded" : ""}`}
        onClick={() => setComposerOpen(true)}
        type="button"
        aria-label={`${studentName} 캐릭터 꾸미기`}
        style={{ width: size }}
      >
        <AvatarImage selection={selection} size={size} crop={crop} />
      </button>
      <AvatarComposer
        studentId={studentId}
        studentName={studentName}
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSaved={(next) => setSelection(next)}
      />
    </>
  );
}
