# Product Blueprint

## Design Principle

Build a learning brain, not a quiz engine.

The system should remember what the child tried, what improved, what remains
fragile, and which topics make the child speak or write more naturally. Every
daily interaction should update the student's model in a small, traceable way.

## Core Loop

```text
daily interaction
  -> transcript or writing sample
  -> structured evaluation
  -> evidence-backed observations
  -> updated skill state
  -> adaptive next task
  -> parent summary
```

## Memory Types

### Session Memory

One page per daily session:

- date
- mode: chat, role play, picture description, writing
- topic
- transcript or submitted text
- short summary
- detected strengths
- detected errors
- next opportunity

### Skill Memory

One page per tracked skill:

- current level
- recent evidence
- common mistakes
- successful examples
- readiness notes
- active next tasks

Example skills:

- past tense
- reason-giving with because
- comparative adjectives
- paragraph coherence
- topic expansion

### Interest Memory

One page for interests and motivation:

- high-engagement topics
- low-engagement topics
- preferred activities
- confidence signals
- topics to reuse for practice

## Observation Schema

```json
{
  "student_id": "student_001",
  "type": "skill_pattern",
  "skill": "past_tense",
  "claim": "The student often uses present-tense verbs when describing past events.",
  "confidence": 0.72,
  "evidence_event_ids": ["event_2026_05_22_chat"],
  "first_seen": "2026-05-22",
  "last_seen": "2026-05-22",
  "status": "active"
}
```

## Skill State Schema

```json
{
  "student_id": "student_001",
  "skill": "reason_giving",
  "level": "emerging",
  "signals": [
    "Uses because in short answers",
    "Needs support to add a second reason"
  ],
  "next_targets": [
    "Use because and so in the same answer",
    "Give two reasons for a preference"
  ],
  "updated_at": "2026-05-22"
}
```

## Adaptive Task Contract

```json
{
  "task_id": "task_2026_05_23_001",
  "student_id": "student_001",
  "mode": "speaking",
  "prompt": "Tell me about your favorite place. Use because, so, and when.",
  "target_skills": ["reason_giving", "sentence_expansion"],
  "difficulty": "A1_plus",
  "why_this_task": "The student can name preferences but needs practice explaining reasons.",
  "success_criteria": [
    "Says at least four sentences",
    "Uses because at least once",
    "Adds one detail about time or place"
  ]
}
```

## Evaluation Rubric

Every completed task should produce quantitative scores and qualitative notes.

Writing metrics:

- structure
- logic
- sentence craft
- grammar
- expression

Speaking metrics:

- fluency
- pronunciation
- response length
- interaction
- accuracy

Speaking practice loop:

1. The child presses Start recording.
2. The app records browser microphone audio.
3. The server transcribes the audio.
4. The server evaluates the transcript with the speaking rubric.
5. The app shows structure, sentence, word, and fluency feedback.
6. The app gives topic-bound reference sentences rewritten from what the child actually said.
7. The child clicks a reference sentence to hear the improved phrasing.
8. The child records the full answer again using those improved sentences as support.
9. The app tracks score changes by attempt.

Each evaluation snapshot stores:

- overall score
- metric scores
- strengths
- needs-practice notes
- evidence link to the submitted answer or conversation

Speaking attempts also store transcript, score, metric scores, reference
sentences, feedback sections, and durable memory notes so the Student Brain can
explain what improved over time.

Writing revision loop:

1. The child writes a first draft.
2. The app evaluates it like a writing teacher, with scores for structure,
   logic, sentence craft, grammar, and expression.
3. The app shows qualitative correction notes and a stronger teacher revision.
4. The app turns several student-written phrases into stronger practice
   sentences.
5. The child types those improved sentences.
6. The child rewrites the full answer and submits it again for a new score.
7. The app compares the rewrite with the previous draft, showing score change,
   concrete improvements, and remaining targets.
8. Revision submissions track progress but do not grant another daily reward.

## Reward System

Rewards are explicit learning currency. They should be earned for actions and
milestones, not used as a hidden score.

Daily completion:

- Completing the daily task grants the configured reward amount.
- The default is `1 reward`.
- The reward ledger stores every grant with a reason and source.

Skill milestones:

- A skill reaching a level threshold can grant bonus rewards.
- Example: `reason_giving` reaches `growing` for the first time -> `5 rewards`.
- Milestones should be one-time grants unless a parent manually resets them.
- The current MVP grants a one-time `5 reward` bonus when a skill reaches
  `strong` or a score of `80+`.

Parent prize goals:

- Parents can set an active prize goal.
- Example: `100 rewards -> 액정 태블릿`.
- The app tracks current rewards against the target.
- Claiming a prize should mark the goal as claimed and optionally subtract or
  reset rewards depending on the family rule.

Reward rules:

- Attendance reward: grants rewards after a target number of lessons.
- Score growth reward: grants rewards when a child reaches a target overall
  score.
- Each child can have multiple active reward rules.

## MVP Screens

- Play: Speaking or Writing only
- Speaking: chat-style topic conversation
- Writing: word pad plus Brainstorm helper
- History: compact lesson trail on the left
- Progress: daily score climb across speaking, writing, and confidence
- Reward: reward balance, prize target, remaining rewards
- Parent: child progress and reward structure controls

Parent level settings:

- Jiyool: United States Grade 7 level.
- Hayool: United States Grade 5 level.
- Speaking and writing prompts should be generated separately from each child's
  current level.

## Retrieval Strategy

Start simple:

- exact search over observations and session summaries
- recency weighting
- skill and topic filters
- evidence links

Add later:

- embeddings for semantically similar sessions
- graph edges between skills, tasks, interests, and errors
- reranking for parent/teacher queries

## Daily Consolidation Job

Run after each session or once per day:

1. Merge duplicate observations.
2. Increase or decrease confidence based on new evidence.
3. Supersede outdated claims.
4. Update skill states.
5. Generate tomorrow's suggested task.
6. Produce a parent-readable summary.
