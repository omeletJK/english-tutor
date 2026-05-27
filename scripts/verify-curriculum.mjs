/* eslint-disable */
/**
 * Verify grade-aware task generation + evaluation by hitting OpenAI directly
 * with the same prompt shape used by lib/task-generator.ts and lib/openai.ts.
 *
 *   node scripts/verify-curriculum.mjs
 *
 * Requires OPENAI_API_KEY in .env.local. Outputs a markdown-style report on
 * stdout. NOT part of the runtime app; safe to leave in repo or delete.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ----------------- bootstrap: load .env.local manually ----------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadDotenv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}
loadDotenv();

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY missing");
  process.exit(1);
}
const MODEL = process.env.OPENAI_EVALUATION_MODEL || "gpt-5.4-mini";

/* ----------------- parse docs/curriculum-standards.md ------------------ */
const DOC = fs.readFileSync(
  path.join(ROOT, "docs", "curriculum-standards.md"),
  "utf8"
);

function stripAnchor(text) {
  return text
    .replace(/\s*\(\s*(?:anchor:\s*)?[A-Z]{1,3}\.[A-Z0-9-]+\.[A-Z0-9-]+\s*\)\s*$/u, "")
    .trim();
}

function detectSchoolBand(stage) {
  if (stage.includes("초등학교")) return "elementary";
  if (stage.includes("중학교")) return "middle";
  if (stage.includes("고등학교")) return "high";
  return "elementary";
}

const LABEL_KEY = {
  "One-line": "oneLine",
  Reading: "reading",
  Writing: "writing",
  "Speaking & Listening": "speakingListening",
  Language: "language",
  "Sentence complexity": "sentenceComplexity",
  "Vocabulary range": "vocabularyRange",
  "Reasoning structure": "reasoningStructure"
};

function parseGrades(raw) {
  const out = {};
  const blocks = raw.split(/^### Grade\s+/gm).slice(1);
  for (const block of blocks) {
    const nl = block.indexOf("\n");
    const head = nl === -1 ? block : block.slice(0, nl);
    const body = nl === -1 ? "" : block.slice(nl + 1);
    const m = /^(\d+)\s*[—-]\s*(\S+)\s*\/\s*(.+?)\s*$/u.exec(head.trim());
    if (!m) continue;
    const grade = Number(m[1]);
    const cefr = m[2].trim();
    const stage = m[3].trim();
    const band = detectSchoolBand(stage);
    const areas = {};
    for (const line of body.split("\n")) {
      if (line.trim().startsWith("###") || line.trim().startsWith("---")) break;
      const bm = /^\s*-\s+\*\*([^*]+)\*\*\s*:\s*(.+?)\s*$/u.exec(line);
      if (!bm) continue;
      const k = LABEL_KEY[bm[1].trim()];
      if (!k) continue;
      areas[k] = stripAnchor(bm[2]);
    }
    out[`G${grade}`] = {
      key: `G${grade}`,
      usLabel: `Grade ${grade}`,
      stageLabel: stage,
      schoolBand: band,
      cefrEquivalent: cefr,
      areas
    };
  }
  return out;
}

const GRADES = parseGrades(DOC);

function curriculumSnippet(key, mode) {
  const g = GRADES[key];
  const a = g.areas;
  const header = `Grade ${g.usLabel.replace("Grade ", "")} expectations (CCSS-aligned, ${g.stageLabel}, ~${g.cefrEquivalent}):`;
  const lines =
    mode === "writing"
      ? [
          `- Writing: ${a.writing}`,
          `- Reading: ${a.reading}`,
          `- Speaking & Listening: ${a.speakingListening}`,
          `- Language: ${a.language}`,
          `- Sentence complexity: ${a.sentenceComplexity}`,
          `- Vocabulary range: ${a.vocabularyRange}`,
          `- Reasoning: ${a.reasoningStructure}`
        ]
      : [
          `- Speaking & Listening: ${a.speakingListening}`,
          `- Reading: ${a.reading}`,
          `- Writing: ${a.writing}`,
          `- Language: ${a.language}`,
          `- Sentence complexity: ${a.sentenceComplexity}`,
          `- Vocabulary range: ${a.vocabularyRange}`,
          `- Reasoning: ${a.reasoningStructure}`
        ];
  return `${header}\n${lines.join("\n")}`;
}

/* ----------------- OpenAI helpers ----------------- */
async function callOpenAI(instructions, inputObj) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      instructions,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(inputObj) }]
        }
      ]
    })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = await res.json();
  if (typeof j.output_text === "string" && j.output_text.length > 0) return j.output_text;
  const chunks = [];
  for (const item of j.output ?? []) {
    for (const c of item.content ?? []) {
      if (typeof c.text === "string") chunks.push(c.text);
    }
  }
  return chunks.join("\n").trim();
}

/* ----------------- Domain pools (mirror of lib/task-generator) -------- */
const DOMAIN_POOLS = {
  elementary: [
    "school life",
    "family & home",
    "friends",
    "hobbies & games",
    "food & cooking",
    "nature & animals",
    "weather & seasons",
    "sports & play",
    "art & music",
    "holidays & traditions",
    "imagination & future",
    "books & stories"
  ],
  middle: [
    "school life",
    "family & relationships",
    "hobbies & creative interests",
    "nature & environment",
    "science & discovery",
    "technology in daily life",
    "ethics & fairness",
    "news & current events",
    "arts, books & media",
    "history & culture",
    "sports & health",
    "future & big questions",
    "money & responsibility",
    "neighborhood & community"
  ],
  high: [
    "society & community",
    "philosophy & big questions",
    "ethics & moral dilemmas",
    "current events & news",
    "science & innovation",
    "technology's impact on society",
    "arts, literature & media",
    "history & culture",
    "economics, work & money",
    "personal identity & belief",
    "global issues & politics",
    "human nature & psychology",
    "education & learning itself",
    "environment & climate"
  ]
};

/* ----------------- Task generation (mirror of lib/task-generator) ----- */
async function generateTask(gradeKey, mode, avoidPrompts = []) {
  const g = GRADES[gradeKey];
  const snippet = curriculumSnippet(gradeKey, mode);
  const domainPool = DOMAIN_POOLS[g.schoolBand];
  const instructions =
    mode === "speaking"
      ? [
          "You are an expert English tutor. Write ONE open thinking question that a real human teacher would ask a child at the given CEFR/grade level for a 30-90 second spoken answer.",
          "The question must invite the student to think and form their own answer. It should not dictate sentence structure.",
          "STRICTLY FORBIDDEN: fill-in-blank templates, required first sentences, numbered sentence checklists, 'choose a starter', word banks, or any scaffolding that pre-builds the answer.",
          "Calibrate difficulty by topic abstraction and response length expectation, NOT by adding scaffolds.",
          "The prompt should be 1-2 sentences total. Return only valid JSON."
        ].join(" ")
      : [
          "You are an expert English tutor. Write ONE open thinking question that a real human teacher would assign for a short written paragraph (4-8 sentences) at the given CEFR/grade level.",
          "The question must invite the student to organize their own thoughts. It should not dictate sentence structure.",
          "STRICTLY FORBIDDEN: fill-in-blank templates, required first sentences, numbered sentence checklists, 'choose a starter', word banks, or any scaffolding.",
          "Calibrate difficulty by topic abstraction and expected paragraph length, NOT by adding scaffolds.",
          "The prompt should be 1-2 sentences total. Return only valid JSON."
        ].join(" ");

  const body = {
    task_mode: mode,
    student: {
      displayName: "Test Student",
      cefrLevel: g.cefrEquivalent,
      usGradeLevel: g.usLabel,
      schoolBand: g.schoolBand,
      stageLabel: g.stageLabel,
      levelDescription: "",
      curriculumStandard: snippet
    },
    skillStates: [],
    recentObservations: [],
    today: new Date().toISOString().slice(0, 10),
    recent_prompts_to_avoid: avoidPrompts,
    domain_pool: domainPool,
    authoring_rules: [
      "STEP 1 — DOMAIN FIRST. Choose ONE domain from domain_pool. Set requested_shape.domain to that exact string. The chosen domain MUST be different from the dominant domain of every entry in recent_prompts_to_avoid.",
      "STEP 2 — WRITE THE PROMPT inside the chosen domain. No rephrasing, no same-subject-different-verb.",
      "Match the student's CEFR level and US grade. Calibrate to student.curriculumStandard.",
      "Target at most two skills, snake_case.",
      "Korean generatedReason must mention the chosen domain in Korean.",
      "Korean successCriteria are evaluation hints about thinking outcomes."
    ],
    requested_shape: {
      domain: "exact string from domain_pool — DECIDE FIRST, must rotate away from recent_prompts_to_avoid",
      mode: "speaking | writing",
      prompt: "1-2 sentence open thinking question, anchored in chosen domain",
      targetSkills: ["snake_case"],
      rewardValue: 1,
      generatedReason: "Korean: cite the rotated domain",
      successCriteria: ["Korean", "Korean"]
    }
  };

  const text = await callOpenAI(instructions, body);
  try {
    return JSON.parse(text);
  } catch {
    return { prompt: text };
  }
}

/* ----------------- Evaluation (mirror of evaluateLearningEvent writing) */
async function evaluateAnswer(gradeKey, taskPrompt, childAnswer) {
  const g = GRADES[gradeKey];
  const snippet = curriculumSnippet(gradeKey, "writing");
  const instructions =
    "You are an exceptional English writing teacher for a school-age child. Return only valid JSON matching the requested shape. Use the provided student_context to calibrate the rigor of feedback and the difficulty of the suggested next task. Give specific Korean feedback on structure, logic, sentence quality, grammar, vocabulary, expression, and coherence." +
    " SCORING RULE: 70 is the MODE for an on-level answer, not a floor. An answer that just meets the standard scores 70-72, not 80. Reserve 80+ for answers that CLEARLY EXCEED the standard (reframe, multiple perspectives, explicit limits, reasoning beyond what the grade requires). 60- for answers that miss the task or have many basic errors. Individual rubric metrics should average within ±5 of overallScore." +
    " GRADE CALIBRATION: student_context.curriculumStandard describes CCSS-aligned expectations for the student's target US grade. Evaluate sentence complexity, vocabulary range, and reasoning depth against that standard. Do NOT cite CCSS codes or grade numbers back to the student in feedbackForChild." +
    " GRADE GAP RULE (strict): If the answer's sentence complexity, vocabulary range, OR reasoning depth is CLEARLY BELOW the curriculumStandard for ANY ONE of those three dimensions, overallScore MUST be ≤60 even when the answer is grammatical and addresses the task. Examples that trigger ≤60: registered as Grade 7+ but the answer reads like Grade 3 (5-7 word sentences, no academic vocabulary, fact + 'because' only); registered as Grade 11+ but no reframe / limits / multi-perspective reasoning appears. Do not soften this rule out of warmth — the parent needs the signal. Strengths/needsPractice fields should name the specific gap (e.g., '복문 사용', '학년 academic 어휘', '반대 관점 인정').";

  const body = {
    task_mode: "writing",
    child_answer: childAnswer,
    is_revision: false,
    student_context: {
      displayName: "Test Student",
      cefrLevel: g.cefrEquivalent,
      usGradeLevel: g.usLabel,
      stageLabel: g.stageLabel,
      schoolBand: g.schoolBand,
      curriculumStandard: snippet,
      levelDescription: "",
      skillStates: [],
      recentObservations: []
    },
    task_prompt: taskPrompt,
    requested_shape: {
      feedbackForChild: "Korean sentence, max 2 sentences",
      parentNote: "Korean sentence, max 2 sentences",
      evaluation: {
        overallScore: 0,
        metrics: [
          { label: "Structure", score: 0 },
          { label: "Logic", score: 0 },
          { label: "Sentence craft", score: 0 },
          { label: "Grammar", score: 0 },
          { label: "Expression", score: 0 }
        ],
        strengths: ["Korean"],
        needsPractice: ["Korean"]
      }
    }
  };

  const text = await callOpenAI(instructions, body);
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

/* ----------------- Test answers (handcrafted, calibrated by hand) ----- */
// G2 (~A1) — short concrete sentences, simple connective
const ANSWER_G2 = `I like my dog. His name is Max. He is brown and small. He likes to play with a ball. When I come home, he runs fast. I am happy because he is my friend.`;

// G5 (~A2+) — 4-step opinion paragraph, simple complex sentence, modest academic words
const ANSWER_G5 = `I think reading every day is a good habit because it builds your imagination. When I read, I learn new words that I can use in writing. For example, last week I read a story about a girl who climbed a mountain, and I wrote my own short story using the word "determined." Reading also helps me focus better, especially before bed. That is why I believe everyone should read for at least twenty minutes each day.`;

// G8 (~B2) — multi-paragraph argument with concession + rebuttal
const ANSWER_G8 = `Some people argue that students should not be allowed to use phones at school because phones distract them from learning. While that concern is reasonable for younger children, banning phones entirely ignores how older students actually use them. In my experience, my phone helps me look up unfamiliar vocabulary during reading and capture homework details before I forget. The real problem is not the phone itself but the lack of clear rules about when to put it away. A better policy would let teachers decide when phones are useful for class and when they should stay in lockers. That way, schools can prevent distraction without removing a tool many students genuinely rely on.`;

// G11 (~C1) — abstract argument with reframe + limits
const ANSWER_G11 = `The conventional wisdom that productivity equates to constant motion deserves reexamination, particularly in an era where attention itself has become contested terrain. While checking off tasks feels meaningful, much of what passes for productivity is actually displacement activity that protects us from difficult thinking. A more useful frame, in my view, is that real productivity is measured not by volume but by the quality of decisions a person can sustain over time — and sustained quality requires deliberate idleness. Of course, this reframing has limits: idleness as a luxury cannot solve structural problems for those whose work is paid by the hour. Still, even under such constraints, the broader principle holds: any culture that treats restlessness as virtue will struggle to produce the kind of clear thinking complex problems require.`;

const ANSWERS_BY_GRADE = { G2: ANSWER_G2, G5: ANSWER_G5, G8: ANSWER_G8, G11: ANSWER_G11 };

/* ----------------- Main run ----------------- */
function shortPrompt(p) {
  if (!p) return "(no prompt)";
  const s = typeof p === "string" ? p : JSON.stringify(p);
  return s.length > 200 ? s.slice(0, 200) + "…" : s;
}

async function runDomainRotation() {
  console.log("# Domain rotation check — 3 consecutive 'refresh' calls per grade\n");
  console.log(`Model: ${MODEL}\n`);
  console.log(
    "For each grade we call task generation 3 times in a row, accumulating the\n" +
      "prior prompts into recent_prompts_to_avoid. Expect each call to land in a\n" +
      "clearly different domain (e.g., not 3× school-rules variants).\n"
  );
  const rounds = [
    { grade: "G5", mode: "writing" },
    { grade: "G8", mode: "writing" },
    { grade: "G11", mode: "writing" }
  ];
  for (const r of rounds) {
    console.log(`\n## ${r.grade} · ${r.mode}\n`);
    const seen = [];
    for (let i = 1; i <= 3; i += 1) {
      const t = await generateTask(r.grade, r.mode, seen);
      const prompt = t.prompt ?? "(none)";
      const domain = t.domain ?? "(no domain field)";
      console.log(`- **Call ${i}** [domain: ${domain}] — ${prompt}`);
      seen.push(prompt);
    }
  }
}

async function main() {
  if (process.argv.includes("--domain-rotation")) {
    await runDomainRotation();
    return;
  }

  const TARGET_GRADES = ["G2", "G5", "G8", "G11"];
  const tasks = {};

  console.log("# Curriculum calibration verification\n");
  console.log(`Model: ${MODEL}  ·  Grades tested: ${TARGET_GRADES.join(", ")}\n`);

  /* --- Part 1: task generation per grade, both modes --- */
  console.log("## Part 1 — Generated tasks per grade\n");
  console.log("| Grade | Mode | Prompt |");
  console.log("|---|---|---|");
  for (const gk of TARGET_GRADES) {
    tasks[gk] = {};
    for (const mode of ["writing", "speaking"]) {
      try {
        const t = await generateTask(gk, mode);
        tasks[gk][mode] = t.prompt ?? "(no prompt)";
        console.log(`| ${gk} | ${mode} | ${(t.prompt ?? "(no prompt)").replace(/\|/g, "\\|")} |`);
      } catch (e) {
        tasks[gk][mode] = `(error: ${e.message})`;
        console.log(`| ${gk} | ${mode} | ERROR: ${e.message} |`);
      }
    }
  }

  /* --- Part 2: cross-evaluate single writing task with three answers --- *
   * Pick the G5 writing task and evaluate the G2/G5/G8 hand-crafted answers
   * against it. Then do the same with G9 task + G5/G9/G12 answers if possible.
   */
  console.log("\n## Part 2 — Cross-level evaluation (single task, varied answers)\n");
  console.log(
    "Each row: a hand-crafted answer at some level is evaluated against the task\n" +
      "that was generated for the listed target grade. Expectation: answer at the same\n" +
      "level as the target grade should score ~70 ; clearly below ≤60 ; clearly above ≥80.\n"
  );

  const evalRuns = [
    { targetGrade: "G5", answerKey: "G2", expect: "below" },
    { targetGrade: "G5", answerKey: "G5", expect: "on-level" },
    { targetGrade: "G5", answerKey: "G8", expect: "above" },
    { targetGrade: "G8", answerKey: "G5", expect: "below" },
    { targetGrade: "G8", answerKey: "G8", expect: "on-level" },
    { targetGrade: "G8", answerKey: "G11", expect: "above" },
    { targetGrade: "G11", answerKey: "G5", expect: "below" },
    { targetGrade: "G11", answerKey: "G8", expect: "below" },
    { targetGrade: "G11", answerKey: "G11", expect: "on-level" }
  ];

  console.log(
    "| Target | Answer at | Expect | overallScore | Metrics avg | Strengths | NeedsPractice |"
  );
  console.log("|---|---|---|---|---|---|---|");
  for (const r of evalRuns) {
    const task = tasks[r.targetGrade]?.writing;
    const answer = ANSWERS_BY_GRADE[r.answerKey];
    if (!task || !answer) {
      console.log(
        `| ${r.targetGrade} | ${r.answerKey} | ${r.expect} | (skip) | | | |`
      );
      continue;
    }
    try {
      const result = await evaluateAnswer(r.targetGrade, task, answer);
      const score = result?.evaluation?.overallScore ?? "?";
      const metrics = result?.evaluation?.metrics ?? [];
      const avg = metrics.length
        ? (
            metrics.reduce((s, m) => s + (Number(m.score) || 0), 0) / metrics.length
          ).toFixed(1)
        : "?";
      const strengths = (result?.evaluation?.strengths ?? []).join("; ");
      const needs = (result?.evaluation?.needsPractice ?? []).join("; ");
      console.log(
        `| ${r.targetGrade} | ${r.answerKey} | ${r.expect} | **${score}** | ${avg} | ${shortPrompt(strengths)} | ${shortPrompt(needs)} |`
      );
    } catch (e) {
      console.log(
        `| ${r.targetGrade} | ${r.answerKey} | ${r.expect} | ERROR | | | ${e.message} |`
      );
    }
  }

  /* --- Part 3: task-aligned cross-level evaluation (task fit pinned, only ----
   * grade fit varies). Uses hardcoded uniforms task + hardcoded uniforms
   * answers at G2/G5/G8/G11 levels. The same task is evaluated for students
   * registered at G5 and G8 so we can see if grade-gap penalises lower-than-
   * registered answers even when the topic is on target.
   * ------------------------------------------------------------------------*/
  const TASK_G5_UNIFORMS =
    "Do you think school uniforms are a good idea for students your age? Explain your opinion and give reasons and examples from your own experience or what you have seen.";
  const TASK_G8_UNIFORMS =
    "Some people think school uniforms help students focus more on learning, while others believe uniforms limit personal expression. What is your opinion, and why?";

  const UNIFORM = {
    G2:
      "I like my school clothes. They are blue. Uniforms are good. Everyone wears the same. We do not look different. I am happy with uniforms.",
    G5:
      "I think school uniforms are a good idea for students our age. First, uniforms save time in the morning because we don't have to choose what to wear. Second, when everyone wears the same thing, no one feels bad about their clothes. For example, in my class last year, some kids felt left out because they didn't have new clothes. With uniforms, that problem goes away. That is why I believe schools should ask students to wear uniforms.",
    G8:
      "I believe school uniforms are a fair idea, even though I understand the worry that they limit personal expression. While clothing can be a way to show identity, the school day is mostly about learning, and reducing the time and worry around clothes lets students focus on what matters. In my middle school, students used to compare brands and feel pressure to keep up; uniforms quietly removed that pressure. A reasonable middle ground would let students personalize with small details — a pin, a watch, hairstyle — so the school keeps its calm look without erasing individuality. That balance makes uniforms more defensible than they first appear.",
    G11:
      "The school-uniform debate usually pits discipline against self-expression, but that framing obscures what is actually at stake: how a school decides which differences among students it makes visible. Uniforms do not erase identity; they redistribute the cues that signal it — sometimes in ways that protect lower-income students from peer comparison, sometimes in ways that flatten cultural expression. A more honest argument for uniforms is not that they remove distraction — research on that is mixed — but that they negotiate a temporary social contract: in the building, we agree to dial down the public theater of class and taste so that other forms of difference (ideas, voice, effort) can become legible. That defense has limits, of course. It depends on whether the dress code is enforced equitably and whether the chosen uniform itself encodes a narrow cultural ideal."
  };

  const PART3_RUNS = [
    { registered: "G5", task: TASK_G5_UNIFORMS, answer: "G2", expect: "below" },
    { registered: "G5", task: TASK_G5_UNIFORMS, answer: "G5", expect: "on-level" },
    { registered: "G5", task: TASK_G5_UNIFORMS, answer: "G8", expect: "above" },
    { registered: "G8", task: TASK_G8_UNIFORMS, answer: "G2", expect: "below" },
    { registered: "G8", task: TASK_G8_UNIFORMS, answer: "G5", expect: "below" },
    { registered: "G8", task: TASK_G8_UNIFORMS, answer: "G8", expect: "on-level" },
    { registered: "G8", task: TASK_G8_UNIFORMS, answer: "G11", expect: "above" }
  ];

  console.log(
    "\n## Part 3 — Task-aligned evaluation (task fit pinned, only grade fit varies)\n"
  );
  console.log(
    "Same uniforms task, same uniforms topic in every answer. The only thing\n" +
      "that varies is the writing level. Expectation: on-level ≈ 70-72, clearly\n" +
      "below ≤ 60, clearly above ≥ 80. Grade-gap rule should fire when the\n" +
      "registered grade is G8 but the answer is at G2/G5 level.\n"
  );
  console.log(
    "| Registered | Task | Answer level | Expect | Overall | Metrics avg | Strengths | NeedsPractice |"
  );
  console.log("|---|---|---|---|---|---|---|---|");
  for (const r of PART3_RUNS) {
    try {
      const result = await evaluateAnswer(r.registered, r.task, UNIFORM[r.answer]);
      const score = result?.evaluation?.overallScore ?? "?";
      const metrics = result?.evaluation?.metrics ?? [];
      const avg = metrics.length
        ? (
            metrics.reduce((s, m) => s + (Number(m.score) || 0), 0) / metrics.length
          ).toFixed(1)
        : "?";
      const strengths = (result?.evaluation?.strengths ?? []).join("; ");
      const needs = (result?.evaluation?.needsPractice ?? []).join("; ");
      const taskShort = r.task.length > 40 ? r.task.slice(0, 40) + "…" : r.task;
      console.log(
        `| ${r.registered} | ${taskShort.replace(/\|/g, "\\|")} | ${r.answer} | ${r.expect} | **${score}** | ${avg} | ${shortPrompt(strengths)} | ${shortPrompt(needs)} |`
      );
    } catch (e) {
      console.log(
        `| ${r.registered} | (err) | ${r.answer} | ${r.expect} | ERROR | | | ${e.message} |`
      );
    }
  }

  /* --- Part 4: reference for human review --- */
  console.log("\n## Part 4 — Reference: writing tasks used in Part 2\n");
  for (const gk of ["G5", "G8", "G11"]) {
    console.log(`- **${gk}**: ${tasks[gk]?.writing ?? "(none)"}`);
  }

  console.log("\n## Part 5 — Reference: hand-crafted answers (Part 2)\n");
  for (const gk of ["G2", "G5", "G8", "G11"]) {
    console.log(`### ${gk}\n\n> ${ANSWERS_BY_GRADE[gk]}\n`);
  }

  console.log("\n## Part 6 — Reference: task-aligned uniforms answers (Part 3)\n");
  for (const gk of ["G2", "G5", "G8", "G11"]) {
    console.log(`### ${gk} — uniforms\n\n> ${UNIFORM[gk]}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
