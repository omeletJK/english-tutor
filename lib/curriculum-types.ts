/* ----------------------------------------------------------------------------
 * Curriculum types — client-safe.
 *
 * Type definitions and pure helpers that can be safely imported from client
 * components. The actual curriculum data lives in docs/curriculum-standards.md
 * and is parsed server-side by `lib/curriculum.ts` (which uses `node:fs` and
 * is therefore server-only).
 * -------------------------------------------------------------------------- */

export type GradeKey =
  | "G1" | "G2" | "G3" | "G4" | "G5" | "G6"
  | "G7" | "G8" | "G9" | "G10" | "G11" | "G12";

export type SchoolBand = "elementary" | "middle" | "high";

export type GradeMeta = {
  key: GradeKey;
  usLabel: string;        // DB-stored label, e.g. "Grade 5"
  optionLabel: string;    // <option> text shown to parents
  stageLabel: string;     // 한국어 단계 라벨, e.g. "미국 초등학교 5학년 수준"
  schoolBand: SchoolBand;
  cefrEquivalent: string; // Approximate CEFR mapping
  oneLine: string;        // 한 줄 한국어 설명 (settings note)
};

export type CurriculumMode = "writing" | "speaking";

/* Pure helpers (no fs, safe in any environment) */

export function gradeKeyFromUsLabel(label: string): GradeKey {
  const match = /(\d+)/.exec(label ?? "");
  if (!match) return "G5";
  const n = Number(match[1]);
  if (n >= 1 && n <= 12) return `G${n}` as GradeKey;
  return "G5";
}

const SCHOOL_BAND_LABEL: Record<SchoolBand, string> = {
  elementary: "초등학교",
  middle: "중학교",
  high: "고등학교"
};

export function buildOptionLabel(gradeNumber: number, band: SchoolBand): string {
  return `Grade ${gradeNumber} (US ${gradeNumber}학년 · ${SCHOOL_BAND_LABEL[band]})`;
}
