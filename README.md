# AI English Learning Companion

> **Product thesis**: 아이의 사고와 언어 성장을 장기적으로 함께 기억하는 companion.
> 교육을 stateful adaptive learning policy의 optimization 문제로 재정의하는 RL-style lifelong tutoring companion.

**Core architecture docs (반드시 먼저 읽기):**
- [docs/architecture.md](docs/architecture.md) — 시스템 전체 thesis. 7개 기둥, closed-loop, 4-tier memory, skill graph, learner identity, shared memory moments
- [docs/companion-voice.md](docs/companion-voice.md) — 학생-facing voice charter. 모든 student-facing copy의 단일 source of truth

---

This repository is for an AI English learning companion that builds a persistent
learning brain for a child, tracks daily conversation and writing growth, and
generates adaptive English tasks from the child's evolving ability.

The product is inspired by GBrain's core pattern: persistent markdown-backed
memory, structured facts, graph-style links, hybrid retrieval, and scheduled
memory maintenance. For education, the same idea becomes a living student model
instead of a generic personal knowledge base.

## Product Definition

An AI learning companion that remembers each child's English-learning history,
tracks daily speaking and writing growth, and proposes the next best practice
task based on observed strengths, errors, interests, and readiness.

The goal is not to make another worksheet app. The goal is to create the feeling
of an English friend who remembers the learner, notices progress, and adapts
practice without turning every interaction into a test.

## Core Layers

### 1. Daily Interaction Layer

Short daily English interactions:

- free conversation
- picture description
- role play
- question and answer
- retelling today's events
- topic-based speaking practice

Each session creates a learning event with transcript, language observations,
confidence signals, and follow-up opportunities.

### 2. Writing Homework Layer

Writing submissions are evaluated beyond grammar correction:

- grammar accuracy
- vocabulary range
- sentence complexity
- coherence and flow
- expression of personal ideas
- repeated error patterns
- correction uptake over time

Feedback should be child-friendly, specific, and limited to a few useful next
steps.

### 3. Student Brain

The student brain stores living observations, not just scores.

Example observations:

- The student often confuses past-tense verb forms.
- The student has started using "because" to explain reasons.
- The student speaks more freely about animals, travel, and school life.
- Longer sentences still make tense control unstable.
- The student appears ready for comparative expressions.

These observations should be versioned, dated, and superseded as the learner
changes.

### 4. Progress Model

Track skill growth across speaking, writing, and habits.

Speaking:

- fluency
- response length
- interaction ability
- pronunciation notes when available

Writing:

- grammar
- vocabulary
- sentence complexity
- coherence
- creativity

Learning habits:

- consistency
- confidence
- willingness to revise
- correction uptake

### 5. Adaptive Task Generator

The task generator uses recent evidence and long-term patterns to produce the
next practice task.

Examples:

- If the student can say "I went to..." but weakly explains reasons:
  "Tell me about your favorite place. Use because, so, and when."
- If past tense is weak:
  "Tell me what you did last weekend. Try to use five past-tense verbs."
- If vocabulary is narrow but confidence is high:
  "Describe the same idea in two different ways."

## GBrain-Inspired Mapping

| GBrain concept | English learning equivalent |
| --- | --- |
| Brain | One student's long-term learning memory |
| Source | Conversation, writing, parent notes, teacher notes, curriculum |
| Page | Session summary, writing submission, skill note, interest profile |
| Fact | Stable learner observation with date and confidence |
| Edge | Links between errors, topics, tasks, skills, and evidence |
| Hybrid search | Retrieve exact errors plus semantically similar learning moments |
| Daily cycle | Consolidate observations, update progress, generate tomorrow's task |

## MVP Scope

The first useful version should include:

- student profile
- daily chat transcript capture
- writing submission upload or text entry
- structured feedback generation
- persistent observations
- skill-state dashboard
- adaptive daily task generation
- parent-facing progress summary

The MVP can start with a simple local database and markdown memory files before
adding vector search or a full graph engine.

## Initial Data Model

Suggested entities:

- `students`
- `learning_events`
- `conversation_turns`
- `writing_submissions`
- `observations`
- `skill_states`
- `adaptive_tasks`
- `memory_pages`
- `memory_edges`

The important design rule is that every generated observation should point back
to evidence. A parent or teacher should be able to ask, "Why does the system
think this?" and see the sessions or writings that support the claim.

## Safety And Privacy

Because this is for a child, the product should be privacy-first:

- minimize retained personal data
- separate parent-visible summaries from raw transcripts
- allow deletion and export
- avoid public sharing by default
- keep prompts age-appropriate
- avoid high-stakes labels or medical-style diagnosis

## Next Build Step

The current implementation step is a small private family prototype:

1. Create a student profile.
2. Record a daily conversation or writing sample.
3. Generate structured observations.
4. Store observations with evidence links.
5. Generate one adaptive task for the next session.
6. Award rewards for daily completion and skill milestones.
7. Let parents configure a prize goal, such as 100 rewards for a tablet.

The child-facing UI is intentionally simple:

- Play tab: choose Speaking or Writing.
- Speaking: chat-style turn taking around one topic.
- Writing: word-pad writing with a Brainstorm helper.
- Left rail: recent lesson history.
- Progress tab: daily score movement.
- Reward tab: current reward balance and prize distance.
- Parent tab: parent-only progress and reward controls.

Default demo logins:

- `jiyool@example.com`
- `hayool@example.com`
- `parent@example.com`

## Running The App

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without Supabase or OpenAI environment variables, the app runs in demo mode.
For private deployment, set these values in `.env.local` and Vercel:

- `JIYOOL_EMAIL`
- `HAYOOL_EMAIL`
- `PARENT_EMAIL`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `OPENAI_API_KEY`
- `OPENAI_EVALUATION_MODEL`
- `OPENAI_TRANSCRIBE_MODEL`
- `OPENAI_TTS_MODEL`
- `OPENAI_TTS_VOICE`

Run `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor to
create the database tables.

See [docs/deployment.md](docs/deployment.md) for the deployment checklist.
