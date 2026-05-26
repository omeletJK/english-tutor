import "server-only";
import fs from "node:fs";
import path from "node:path";

import {
  buildOptionLabel,
  gradeKeyFromUsLabel,
  type CurriculumMode,
  type GradeKey,
  type GradeMeta,
  type SchoolBand
} from "@/lib/curriculum-types";

export {
  buildOptionLabel,
  gradeKeyFromUsLabel,
  type CurriculumMode,
  type GradeKey,
  type GradeMeta,
  type SchoolBand
};

/* ----------------------------------------------------------------------------
 * Curriculum standards — single source of truth lives in
 * docs/curriculum-standards.md. This module reads + parses it once per server
 * process and exposes accessor functions for task-generator/openai prompts and
 * for server components that need to render the parent-facing options.
 *
 * Editing curriculum:
 *   1. Edit docs/curriculum-standards.md (keep the bullet/header contract).
 *   2. Restart `next dev` or redeploy. Parser memoizes per module load.
 * -------------------------------------------------------------------------- */

const DOC_PATH = path.join(process.cwd(), "docs", "curriculum-standards.md");

type AreaLines = {
  oneLine: string;
  reading: string;
  writing: string;
  speakingListening: string;
  language: string;
  sentenceComplexity: string;
  vocabularyRange: string;
  reasoningStructure: string;
};

type Parsed = {
  GRADE_META: Record<GradeKey, GradeMeta>;
  GRADE_OPTIONS: GradeMeta[];
  AREAS_BY_GRADE: Record<GradeKey, AreaLines>;
};

let CACHE: Parsed | null = null;

function load(): Parsed {
  if (CACHE) return CACHE;
  const raw = fs.readFileSync(DOC_PATH, "utf8");
  CACHE = parseCurriculumDoc(raw);
  return CACHE;
}

/* ----------------------------------- Parser ------------------------------ */

/** Strip trailing CCSS code reference like "(anchor: RL.1.1)", "(W.5.1)", "(RI.9-10.6)" */
function stripAnchor(text: string): string {
  return text
    .replace(/\s*\(\s*(?:anchor:\s*)?[A-Z]{1,3}\.[A-Z0-9-]+\.[A-Z0-9-]+\s*\)\s*$/u, "")
    .trim();
}

function detectSchoolBand(stageLabel: string): SchoolBand {
  if (stageLabel.includes("초등학교")) return "elementary";
  if (stageLabel.includes("중학교")) return "middle";
  if (stageLabel.includes("고등학교")) return "high";
  throw new CurriculumError(
    `stage label must contain one of 초등학교/중학교/고등학교, got: ${stageLabel}`
  );
}

class CurriculumError extends Error {
  constructor(message: string) {
    super(`Curriculum doc: ${message}`);
    this.name = "CurriculumError";
  }
}

const REQUIRED_LABELS = [
  "One-line",
  "Reading",
  "Writing",
  "Speaking & Listening",
  "Language",
  "Sentence complexity",
  "Vocabulary range",
  "Reasoning structure"
] as const;

type RequiredLabel = (typeof REQUIRED_LABELS)[number];

const LABEL_TO_AREA_KEY: Record<RequiredLabel, keyof AreaLines> = {
  "One-line": "oneLine",
  "Reading": "reading",
  "Writing": "writing",
  "Speaking & Listening": "speakingListening",
  "Language": "language",
  "Sentence complexity": "sentenceComplexity",
  "Vocabulary range": "vocabularyRange",
  "Reasoning structure": "reasoningStructure"
};

function parseCurriculumDoc(raw: string): Parsed {
  const GRADE_META = {} as Record<GradeKey, GradeMeta>;
  const AREAS_BY_GRADE = {} as Record<GradeKey, AreaLines>;

  // Split into per-grade blocks. The split keeps the body without the "### Grade "
  // prefix on each piece.
  const blocks = raw.split(/^### Grade\s+/gm).slice(1);
  if (blocks.length === 0) {
    throw new CurriculumError("no grade sections found (expected '### Grade N — …').");
  }

  const seen = new Set<GradeKey>();
  for (const block of blocks) {
    const firstLineEnd = block.indexOf("\n");
    const headerRest = firstLineEnd === -1 ? block : block.slice(0, firstLineEnd);
    const body = firstLineEnd === -1 ? "" : block.slice(firstLineEnd + 1);

    // header: "N — CEFR / stageLabel"
    const headerMatch = /^(\d+)\s*[—-]\s*(\S+)\s*\/\s*(.+?)\s*$/u.exec(headerRest.trim());
    if (!headerMatch) {
      throw new CurriculumError(
        `bad grade header (expected 'Grade N — CEFR / 스테이지'): "${headerRest.trim()}"`
      );
    }
    const gradeNumber = Number(headerMatch[1]);
    if (gradeNumber < 1 || gradeNumber > 12) {
      throw new CurriculumError(`grade out of supported range (1–12): ${gradeNumber}`);
    }
    const key = `G${gradeNumber}` as GradeKey;
    if (seen.has(key)) {
      throw new CurriculumError(`duplicate grade section: ${key}`);
    }
    seen.add(key);

    const cefr = headerMatch[2].trim();
    const stageLabel = headerMatch[3].trim();
    const schoolBand = detectSchoolBand(stageLabel);

    const areas = extractAreas(body, key);

    GRADE_META[key] = {
      key,
      usLabel: `Grade ${gradeNumber}`,
      optionLabel: buildOptionLabel(gradeNumber, schoolBand),
      stageLabel,
      schoolBand,
      cefrEquivalent: cefr,
      oneLine: areas.oneLine
    };
    AREAS_BY_GRADE[key] = areas;
  }

  // Verify all 12 grades present
  for (let n = 1; n <= 12; n += 1) {
    const k = `G${n}` as GradeKey;
    if (!GRADE_META[k]) {
      throw new CurriculumError(`missing grade section: ${k}`);
    }
  }

  const GRADE_OPTIONS = (Object.keys(GRADE_META) as GradeKey[])
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map((k) => GRADE_META[k]);

  return { GRADE_META, GRADE_OPTIONS, AREAS_BY_GRADE };
}

function extractAreas(body: string, key: GradeKey): AreaLines {
  // Match bullets of form: "- **Label**: content" until a blank line, hr, or
  // next heading. Bullets may run across multiple grade sections in a single
  // body slice — we stop at first '###' or '---'.
  const collected: Partial<Record<keyof AreaLines, string>> = {};
  const bulletRe = /^\s*-\s+\*\*([^*]+)\*\*\s*:\s*(.+?)\s*$/u;

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("###") || trimmed.startsWith("---") || trimmed.startsWith("## ")) {
      break;
    }
    const m = bulletRe.exec(line);
    if (!m) continue;
    const label = m[1].trim();
    const content = stripAnchor(m[2]);
    const areaKey = (LABEL_TO_AREA_KEY as Record<string, keyof AreaLines | undefined>)[label];
    if (!areaKey) continue; // e.g. "학습자 기대" — ignored on purpose
    if (collected[areaKey]) {
      throw new CurriculumError(`duplicate label "${label}" in section ${key}`);
    }
    collected[areaKey] = content;
  }

  const missing = REQUIRED_LABELS.filter(
    (label) => !collected[LABEL_TO_AREA_KEY[label]]
  );
  if (missing.length > 0) {
    throw new CurriculumError(
      `section ${key} is missing required bullets: ${missing.join(", ")}`
    );
  }

  return collected as AreaLines;
}

/* ------------------------------- Public API ------------------------------ */

export function getGradeOptions(): GradeMeta[] {
  return load().GRADE_OPTIONS;
}

export function getGradeMeta(key: GradeKey): GradeMeta {
  return load().GRADE_META[key];
}

export function gradeMetaFromLabel(label: string): GradeMeta {
  return getGradeMeta(gradeKeyFromUsLabel(label));
}

/* Build the per-grade prompt snippet. Mode determines which area is highlighted
 * first; otherwise all 7 lines are included so the model has full context. */
export function curriculumSnippet(key: GradeKey, mode: CurriculumMode): string {
  const { GRADE_META, AREAS_BY_GRADE } = load();
  const meta = GRADE_META[key];
  const areas = AREAS_BY_GRADE[key];

  const header = `Grade ${meta.usLabel.replace("Grade ", "")} expectations (CCSS-aligned, ${meta.stageLabel}, ~${meta.cefrEquivalent}):`;

  const lines =
    mode === "writing"
      ? [
          `- Writing: ${areas.writing}`,
          `- Reading: ${areas.reading}`,
          `- Speaking & Listening: ${areas.speakingListening}`,
          `- Language: ${areas.language}`,
          `- Sentence complexity: ${areas.sentenceComplexity}`,
          `- Vocabulary range: ${areas.vocabularyRange}`,
          `- Reasoning: ${areas.reasoningStructure}`
        ]
      : [
          `- Speaking & Listening: ${areas.speakingListening}`,
          `- Reading: ${areas.reading}`,
          `- Writing: ${areas.writing}`,
          `- Language: ${areas.language}`,
          `- Sentence complexity: ${areas.sentenceComplexity}`,
          `- Vocabulary range: ${areas.vocabularyRange}`,
          `- Reasoning: ${areas.reasoningStructure}`
        ];

  return `${header}\n${lines.join("\n")}`;
}
