# AI-Native Child Learning Architecture

## Context

이 문서는 단순 feature spec이 아니라 **product thesis**다.

> "아이의 사고와 언어 성장을 장기적으로 함께 기억하는 companion"

대부분 AI 교육앱은 기능은 많지만 "무엇을 만드는 시스템인가"라는 identity가 없다. 이 시스템의 identity는 다음 한 줄에 압축된다:

> **교육을 stateful adaptive learning policy의 optimization 문제로 재정의** — 학생 상태(state)를 inference하고, 다음 interaction을 선택하며, 장기 성장 return을 최대화하는 RL-style lifelong tutoring companion.

현재 앱은 매일 두 개의 독립된 prompt를 던진다 (Speaking task + Writing task). `lib/task-generator.ts`는 CEFR/grade와 약점 skill을 보고 "열린 사고 질문"을 생성하지만, **공통된 맥락(context)이 없다**. 누적된 evidence가 **무슨 이야기를 그리는가**도 어디에도 없다. 점수 그래프는 한 주만 지나면 무뎌진다.

### 이 변화가 세우는 7개 기둥

1. **Article-driven daily cognition** — 하나의 아티클을 중심으로 Read → Comprehend → Speak → Write가 점층 심화
2. **Longitudinal narrative** — 시간에 따른 identity 변화를 prose로 짜는 evergreen journal
3. **Companion framing** — 평가 시스템이 아니라 shared journey. "너를 기억하는 친구" 톤
4. **Closed-loop tutoring system** — STATE → POLICY → ACTION → OBSERVATION → MEMORY로 명시적 RL-style loop
5. **Skill dependency graph** — 능력 간 위상 — "다음 unlock 가능한 edge"를 graph traversal로 찾기
6. **Learner identity model** — cognitive + emotional learner profile (shy/imaginative/analytical 등)이 prompt personalization 좌우
7. **Shared memory moments** — companion이 과거를 적극적으로 회상 ("3개월 전에 네가 처음 because를 썼던 날 기억해?")

### Memory를 인간 기억처럼 layered로 본다

| Layer    | 역할              | 매체 |
|----------|-------------------|------|
| Raw      | 모든 interaction  | learning_events, observations, evaluation_snapshots |
| Episodic | 중요한 순간       | memory_moments (신규) |
| Semantic | 장기 패턴         | weekly/monthly narratives + skill_states |
| Identity | learner essence   | learner_profiles + quarterly reflection |

이 4-tier 분리는 단순 scaling을 위한 것이 아니라, **NarrativeWeaver를 사실상 3개 분리된 weaver로 쪼개는 architectural 정정**이다.

### 결정된 사항

- **아티클 소스**: AI 생성 원문 + 출처 참조 (저작권 안전, 레벨 정밀 조정 가능)
- **기존 flow와의 관계**: Article-first가 standalone Speaking/Writing을 **완전히 대체**
- **멀티에이전트 형태**: OpenAI Responses API **순차 체인** (현재 스택 유지)
- **큐레이션 트리거**: 학생 첫 접속 시 **lazy 생성** (UI는 skeleton 로딩)
- **Narrative 레이어**: episode-detect (실시간) + weekly + monthly + quarterly + identity (분기)
- **Voice charter**: 차분하고 따뜻한 관찰자 — 절대 generic AI tone 아님. 별도 문서 [`companion-voice.md`](./companion-voice.md) 참조

---

## Architecture Overview

### Closed-Loop Tutoring System (이름 붙이기)

이 프로젝트는 사실상 강화학습-style closed loop이다. 이 문서부터는 명시적으로 그렇게 부른다.

```
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │   STATE                                                      │
   │   ├─ skill_states (현재 능력)                                │
   │   ├─ observations (살아있는 관찰, 신뢰도 포함)               │
   │   ├─ student_interests (카테고리 engagement)                 │
   │   └─ growth_narrative (장기 성장 이야기, 압축된 history)    │
   │                                                              │
   │           ↓ POLICY (article-curator + question designer)     │
   │                                                              │
   │   ACTION                                                     │
   │   └─ 오늘의 article + comprehension Q + speaking + writing  │
   │                                                              │
   │           ↓ INTERACTION (학생 답변)                          │
   │                                                              │
   │   OBSERVATION (AI evaluator)                                 │
   │   ├─ 즉시 피드백 (child-facing, 따뜻)                       │
   │   ├─ 정량 evaluation_snapshot                                │
   │   └─ 새 observation + skill_state delta                     │
   │                                                              │
   │           ↓ MEMORY UPDATE                                    │
   │                                                              │
   │   STATE' (다음 사이클의 입력)                                │
   │           ↓                                                  │
   │   ┌───────────────────────┐                                  │
   │   │ NARRATIVE WEAVER      │  주 1회 / 월 1회 / 분기 1회     │
   │   │ (long-term return)    │  → growth_narrative 챕터 추가   │
   │   └───────────────────────┘                                  │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
```

각 layer를 코드에서 한 디렉토리/모듈로 분리한다:
- `lib/state/` — state 조회·집계 (현재 `lib/dashboard.ts`의 일부 + 신규)
- `lib/policy/` — article-curator, question-designer (article 기반 task generator), skill-graph 조회
- `lib/observe/` — evaluation, episode-detector (평가 직후 시그니피컨트 모먼트 감지)
- `lib/memory/` — observation/skill_state upsert, semantic-summarizer (weekly/monthly), identity-distiller (quarterly), memory_moments 조회

기존 `lib/openai.ts` (1015줄)는 거대 god-file이므로 이 기회에 위 4개 모듈로 점진적 분해. **이 문서에서 한 번에 분해하지는 않는다** — 신규 코드는 새 모듈에 쓰고, 기존 함수는 그대로 둔 채 단계적으로 옮긴다.

### Layered Memory Map (실시간 → 분기)

```
Interaction → Evaluation
                  │
                  ├─→ Raw layer        (모든 observation/snapshot 저장)
                  │
                  └─→ EpisodeDetector  (cheap LLM call, "이건 significant?")
                            │
                            └─→ Episodic layer (memory_moments)
                                  │
                                  │   매주
                                  ↓
                       SemanticSummarizer ──→ weekly narrative
                                  │
                                  │   매월
                                  ↓
                       SemanticSummarizer ──→ monthly chapter
                                  │
                                  │   분기
                                  ↓
                       IdentityDistiller ──→ learner_profiles 업데이트
                                             + quarterly reflection letter
```

EpisodeDetector는 매 평가 직후 호출 (지연 적음, 200토큰 정도). 나머지 weaver는 lazy trigger.

### 일일 학습 단계 (Play 탭 단일 흐름)

```
Stage 1: Read       — Article 본문 + 어휘 하이라이트 + (옵션) TTS 낭독
Stage 2: Comprehend — 3-5개 독해 질문 (literal / inferential / opinion)
Stage 3: Speak      — Article에서 파생된 스피킹 prompt (녹음 → STT → 평가 → reference sentences → 재녹음)
Stage 4: Write      — Article에서 파생된 라이팅 prompt (작성 → 루브릭 평가 → revision)
```

각 단계는 잠금-해제 진행:
- Comprehend는 Read 시작 후 unlock (강제 대기 없음, 단 학생이 본문을 안 보면 Q는 어려워짐)
- Speak는 Comprehend 1개 이상 답변 후 unlock
- Write는 Speak 첫 녹음 완료 후 unlock
- 일일 보상은 Stage 4까지 완료 시 지급

### 멀티에이전트 큐레이션 체인 (`lib/policy/article-curator.ts`)

각 단계는 별도 OpenAI Responses API 호출. 각 agent는 다른 system instruction + 명확한 입출력 계약을 가짐.

```
[Agent 1: Curator]
  입력: student_id, 최근 14일 article_history, student_interests, category_rotation
  출력: { category, topic_seed, angle, justification }
  역할: 선호도(가중치) × 다양성(어제 카테고리 회피, 7일 내 미사용 카테고리 우선) 균형

[Agent 2: Researcher]
  입력: topic_seed, category, target_cefr
  출력: { core_facts: [...], source_citations: [{title, publisher, year, url?}] }
  역할: 신뢰 가능한 사실 + 인용 가능한 출처 제시 (지식 컷오프 인지)

[Agent 3: Writer]
  입력: facts, citations, student_profile (CEFR, grade, displayName)
  출력: { title, body (200-400 words), vocabulary_highlights, estimated_minutes }
  역할: 학생 레벨에 맞춘 원문 작성. 문단 3-5개, 첫 문단 hook, 마지막 문단 reflection-friendly

[Agent 4: Question Designer]
  입력: article body, student_profile, student의 weak skills, 최근 growth_narrative 1단락
  출력: {
    comprehension_questions: [{ q, type: "literal"|"inferential"|"opinion", expected_focus }],
    speaking_prompt: { prompt, target_skills, success_criteria, why_this_task },
    writing_prompt:  { prompt, target_skills, success_criteria, why_this_task }
  }
  역할: 독해→스피킹→라이팅 사고 사다리 설계. 스피킹은 의견/경험, 라이팅은 분석/논증 쪽으로 자연 분기.
        최근 narrative를 보고 "지난 달에 막 시작한 것"을 한 단계 밀어주는 prompt 선택
```

OpenAI 키가 없으면 `article-curator.ts`의 demo branch가 미리 정의된 데모 아티클 1개를 반환 (현재 demo-data 패턴 유지).

### Narrative Weaver — 장기 성장 이야기

기존 단일 NarrativeWeaver를 architectural correction을 통해 세 모듈로 분리:

- **EpisodeDetector** (`lib/observe/episode-detector.ts`) — 매 평가 직후 cheap LLM call로 시그니피컨트 모먼트 감지 → memory_moments
- **SemanticSummarizer** (`lib/memory/semantic-summarizer.ts`) — weekly/monthly narrative 생성
- **IdentityDistiller** (`lib/memory/identity-distiller.ts`) — 분기 learner_profiles 갱신 + quarterly reflection

```
[Tier A: weekly micro-update] — lazy, 매주 첫 접속 시
  입력: 지난 7일의 evaluation_snapshots, observations, reading_attempts, 직전 narrative tail
  출력: 2-3 문장의 한국어 prose. growth_narratives에 append.
  예: "이번 주에는 because를 처음으로 두 번 연달아 쓴 날이 있었습니다."

[Tier B: monthly chapter] — 학부모 첫 접속 시, 매월 1일
  입력: 지난 30일의 weekly entries + skill_state 변화 diff + 카테고리 분포
  출력: 한 단락의 prose chapter.
  예: "5월의 너는 짧은 문장을 because로 잇기 시작했어. 처음엔 'I like cats because cute'였지만 월 말에는
       'I like cats because they are quiet and gentle' 처럼 두 가지 이유를 붙이는 날이 늘었어."

[Tier C: quarterly reflection] — 학부모-only, 분기 마지막 주
  입력: 3개 monthly chapter + 분기 동안의 강점/약점 trajectory
  출력: 한 페이지짜리 letter.
  역할: "지난 분기에 너의 사고는 이렇게 자랐어. 다음 분기에는 이런 도전이 기다리고 있을 거야." —
        부모 emotional moment 설계
```

각 tier는 demo fallback 있음 (키 없을 때 deterministic prose).

**중요 — narrative는 student-facing이기도 하다.** "Omelet이 기억하는 것" 패널 (학생 화면)에는 Tier A의 가장 최근 entry 1개가 1인칭으로 paraphrase되어 표시된다. 예: "지난주에 네가 because를 두 번 연달아 쓴 거 기억해. 오늘은 그 다음 단계로 가보자."

---

## Skill Dependency Graph

영어 습득의 발달 토폴로지를 명시적으로 모델링한다. observation을 aggregation만 하는 것에서 진화하여, NarrativeWeaver와 Question Designer가 **graph traversal**로 "다음 성장 edge"를 찾는다.

신규 테이블 `skill_edges` + seed migration:

| from_skill | to_skill | edge_type | strength |
|---|---|---|---|
| because_usage | multi_clause_sentence | enables | 0.9 |
| multi_clause_sentence | opinion_paragraph | enables | 0.85 |
| opinion_paragraph | argumentative_writing | enables | 0.8 |
| tense_consistency | narrative_cohesion | enables | 0.9 |
| tense_consistency | temporal_reasoning | enables | 0.7 |
| emotional_vocabulary | opinion_paragraph | builds_on | 0.6 |
| self_initiated_elaboration | inferential_response | co_occurs | 0.7 |
| comparative_reasoning | argumentative_writing | builds_on | 0.75 |
| (… 초기 20-30개 시드, 시간이 지나며 evaluation evidence로 strength 보정 …) |

**활용**:
1. **Question Designer (Agent 4)**: 현재 skill_states에서 score ≥ 70인 노드의 outgoing edges → 아직 emerging/new인 to_skill을 자극하는 prompt 우선
2. **SemanticSummarizer**: "이번 주에 X를 통해 Y로 가는 길이 열렸어" 같은 구조적 서사 가능 — 단순 점수 변화가 아닌 *능력 위상의 변화* 서술
3. **Curator (Agent 1)**: unlocked-but-untested edge를 자극할 category·topic 선호

DB: 신규 `skill_edges` 테이블 + 신규 `lib/policy/skill-graph.ts` (그래프 조회, "next unlock edges from current skill_states" 계산). Seed 데이터는 마이그레이션에 포함.

---

## Learner Identity Profile

기존 `skill_states` (능력)와 `student_interests` (카테고리)에 학습자 **성향**을 더한다. 같은 task라도 학습자에 따라 다르게 paraphrase되어야 한다.

신규 테이블 `learner_profiles` (student_id에 1:1):

```sql
create table public.learner_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  speaking_style text,           -- 'shy' | 'hesitant' | 'talkative' | 'confident' | null
  writing_style text,            -- 'imaginative' | 'factual' | 'analytical' | 'emotional' | null
  persistence text,              -- 'low' | 'medium' | 'high' | null
  risk_taking text,              -- 'cautious' | 'experimental' | null
  feedback_response text,        -- 'praise_motivated' | 'correction_tolerant' | 'error_discouraged' | null
  topic_affinities jsonb not null default '[]'::jsonb,    -- 학생을 활짝 열리게 한 주제 패턴
  confidence_zones jsonb not null default '[]'::jsonb,    -- 잘 말하는 주제군
  vulnerability_zones jsonb not null default '[]'::jsonb, -- 막히는 주제군
  evidence_signals jsonb not null default '{}'::jsonb,    -- 각 차원의 근거 observation_ids
  updated_at timestamptz not null default now()
);
```

**업데이트**: IdentityDistiller가 분기마다 (또는 시그널이 충분히 누적되었을 때 lazy) `learner_profiles`를 갱신. 수동 입력 없음, 모두 observation evidence로 ground.

**활용**:
- Article Writer (Agent 3): `imaginative` 학습자에게는 narrative angle, `analytical`에게는 comparison/structure angle, `emotional`에게는 인물·관계 중심
- Question Designer (Agent 4): `shy speaker`에게는 의견 강요 X, low-stakes warmup 질문 우선; `error_discouraged`에게는 첫 코멘트를 강점으로
- 평가의 `feedback_for_child` tone: profile에 따라 직설성/안전성 조절

초기에는 모든 필드 null. 신호 누적되면 점진 채워짐.

---

## Shared Memory Moments

Companion이 과거를 적극적으로 회상하는 **emotional anchor**. 요약만으로는 약하고, callback이 들어가야 진짜 친구처럼 느껴진다.

신규 테이블 `memory_moments`:

```sql
create table public.memory_moments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  moment_type text not null check (moment_type in (
    'first_time', 'breakthrough', 'struggle_overcome',
    'topic_lit_up', 'honest_disagreement', 'creative_leap'
  )),
  title text not null,            -- 짧은 라벨: "처음 because를 두 번 쓴 날"
  description text not null,      -- 한국어 1-2 문장 설명
  evidence_event_id uuid references public.learning_events(id) on delete set null,
  evidence_quote text,            -- 학생이 실제 한 말/쓴 문장 (원문 그대로 보존)
  occurred_on date not null,
  surfaced_count integer not null default 0,
  last_surfaced_on date,
  created_at timestamptz not null default now()
);

create index memory_moments_student_idx on public.memory_moments(student_id, occurred_on desc);
```

**EpisodeDetector** (`lib/observe/episode-detector.ts`):
- 매 평가 직후 짧은 LLM call (200토큰 내외)
- 입력: 오늘의 학생 답변 + 직전 14일의 비슷한 답변 + 최근 memory_moments
- 출력: `{ is_significant: bool, moment_type?, title?, description?, evidence_quote? }`
- significant=true면 memory_moments에 row 1개 insert
- "처음 ___을 시도", "오래 막혀있던 ___ 해결", "주제 X에서 평소보다 2배 길게 말함" 등을 감지하는 prompt

**Callback 사용**:
- Curator (Agent 1): 일정 주기 (7-14일 또는 관련 카테고리 회귀 시) 오래된 moment를 surface — 그날의 article을 "당시 했던 도전을 한 단계 더"로 framing. `surfaced_count`/`last_surfaced_on`으로 중복 방지
- `CompanionMemoryPanel`: weekly narrative와 memory callback을 토글 노출 (가중치: surfaced_count↓, occurred_on이 ≥ 1개월 전인 것 우선)
- 학부모 `GrowthJournal`: moments를 별도 "기억할 만한 순간들" 타임라인 — 분기 prose 옆에 anchor 역할

---

## Companion Voice Charter (요약)

전문은 [`companion-voice.md`](./companion-voice.md) 참조.

학생-facing 모든 AI 출력은 이 voice를 따른다. NarrativeWeaver 시스템 prompt, EpisodeDetector 출력, 평가의 `feedback_for_child`, CompanionMemoryPanel paraphrase 모두 charter 전문을 system instruction에 inject.

**Voice essence**: 차분하고 따뜻한 관찰자. 오래 함께한 조용한 선생님. 성장의 witness. 기록자.

이 charter는 단순 wording guide가 아니라 **identity guard rail**. 위반 시 system 전체의 product thesis가 무너진다. CI에 grep check 추가 (학생 컴포넌트와 student-facing prompt 파일에 금지 어휘 검출).

---

## Data Model

### 마이그레이션 분할

| 파일 | 내용 |
|---|---|
| `0003_articles.sql` | articles, reading_attempts, student_interests + learning_events/speaking_attempts에 article_id |
| `0004_growth_narratives.sql` | growth_narratives |
| `0005_skill_graph.sql` | skill_edges + 초기 seed 데이터 (20-30 edges) |
| `0006_learner_identity.sql` | learner_profiles + memory_moments |

각 단계가 독립적으로 적용 가능하도록 분할.

### `supabase/migrations/0003_articles.sql` (신규)

```sql
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  article_date date not null,
  category text not null,             -- 'culture' | 'art' | 'engineering' | 'science' | 'current_affairs' | 'news' | 'history' | 'sports' 등
  title text not null,
  body text not null,
  source_citations jsonb not null default '[]'::jsonb,
  vocabulary jsonb not null default '[]'::jsonb,
  estimated_minutes integer not null default 4,
  cefr_level text not null,
  comprehension_questions jsonb not null default '[]'::jsonb,
  speaking_prompt jsonb not null default '{}'::jsonb,
  writing_prompt jsonb not null default '{}'::jsonb,
  curator_reason text not null default '',
  created_at timestamptz not null default now(),
  unique (student_id, article_date)
);

create table public.reading_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  question_index integer not null,
  student_answer text not null,
  ai_evaluation jsonb not null default '{}'::jsonb,
  score integer,
  created_at timestamptz not null default now()
);

create table public.student_interests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  category text not null,
  engagement_score numeric(4,3) not null default 0.5 check (engagement_score >= 0 and engagement_score <= 1),
  last_seen date,
  updated_at timestamptz not null default now(),
  unique (student_id, category)
);

create index articles_student_date_idx on public.articles(student_id, article_date desc);
create index reading_attempts_article_idx on public.reading_attempts(article_id, created_at desc);
```

기존 `learning_events`, `speaking_attempts` 테이블에 `article_id uuid` 컬럼 추가 — 평가 시 article context를 evidence로 추적.

### `supabase/migrations/0004_growth_narratives.sql`

```sql
create table public.growth_narratives (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  tier text not null check (tier in ('weekly', 'monthly', 'quarterly')),
  period_start date not null,
  period_end date not null,
  body text not null,                          -- 한국어 prose. tier별로 길이 다름
  source_signals jsonb not null default '{}'::jsonb,
                                               -- 어떤 evidence를 봤는지 ({observation_ids, snapshot_ids, article_ids})
  created_at timestamptz not null default now(),
  unique (student_id, tier, period_start)
);

create index growth_narratives_student_idx on public.growth_narratives(student_id, tier, period_end desc);
```

### `lib/types.ts` 추가 타입

```typescript
export type ArticleCategory =
  | "culture" | "art" | "engineering" | "science"
  | "current_affairs" | "news" | "history" | "sports";

export type ComprehensionQuestionType = "literal" | "inferential" | "opinion";

export type ArticleVocabulary = {
  word: string;
  definition: string;
  example?: string;
};

export type ArticleCitation = {
  title: string;
  publisher: string;
  year?: number;
  url?: string;
};

export type ComprehensionQuestion = {
  q: string;
  type: ComprehensionQuestionType;
  expectedFocus: string;
};

export type DailyArticle = {
  id: string;
  studentId: string;
  articleDate: string;
  category: ArticleCategory;
  title: string;
  body: string;
  vocabulary: ArticleVocabulary[];
  sourceCitations: ArticleCitation[];
  estimatedMinutes: number;
  cefrLevel: string;
  comprehensionQuestions: ComprehensionQuestion[];
  speakingPrompt: DailyTask;       // 기존 DailyTask 재사용
  writingPrompt: DailyTask;
  curatorReason: string;           // Korean: 왜 이 article을 오늘 골랐는지
};

export type ReadingAttempt = {
  id: string;
  articleId: string;
  questionIndex: number;
  studentAnswer: string;
  aiEvaluation: {
    feedbackForChild: string;
    parentNote: string;
    addresses: boolean;           // 질문에 실제로 답했는가
    accuracyScore: number;        // 0-100
    reasoningQuality: number;     // 0-100 (inferential/opinion만)
  };
  score: number;
  createdAt: string;
};

export type GrowthNarrativeTier = "weekly" | "monthly" | "quarterly";

export type GrowthNarrativeEntry = {
  id: string;
  tier: GrowthNarrativeTier;
  periodStart: string;
  periodEnd: string;
  body: string;                          // 한국어 prose
  sourceSignals: {
    observationIds?: string[];
    snapshotIds?: string[];
    articleIds?: string[];
  };
  createdAt: string;
};
```

`StudentDashboard`에 `todayArticle: DailyArticle | null`, `recentNarrative: GrowthNarrativeEntry | null`, `monthlyChapter: GrowthNarrativeEntry | null` 추가. 기존 `todayTask` / `speakingTask` / `writingTask`는 article의 prompt로 대체되므로 제거 또는 article의 파생물로 전환.

---

## Files to Change

### 신규 생성

**Migrations**
| 파일 | 역할 |
|---|---|
| `supabase/migrations/0003_articles.sql` | articles, reading_attempts, student_interests + 기존 테이블에 article_id |
| `supabase/migrations/0004_growth_narratives.sql` | growth_narratives |
| `supabase/migrations/0005_skill_graph.sql` | skill_edges + 20-30개 seed edges |
| `supabase/migrations/0006_learner_identity.sql` | learner_profiles + memory_moments |

**Docs**
| 파일 | 역할 |
|---|---|
| `docs/architecture.md` | 이 문서 — 프로젝트 공식 architecture thesis |
| `docs/companion-voice.md` | Voice charter 단독 문서 — 디자인·카피 작업 시 단일 참조 |

**Policy (action 선택)**
| `lib/policy/article-curator.ts` | 4-agent OpenAI Responses API 순차 체인. Agent 4는 narrative 1단락 + skill_graph next-edge + learner_profile을 컨텍스트로 받음 |
| `lib/policy/article-loader.ts` | 오늘 article을 DB에서 조회, 없으면 curator 호출 → 저장. category_rotation/interests 업데이트 |
| `lib/policy/skill-graph.ts` | skill_edges 조회. `nextUnlockableEdges(skillStates)` 반환 |

**Observe (interaction → evidence)**
| `lib/observe/comprehension-evaluator.ts` | 독해 답변 평가 (`evaluateComprehensionAnswer`) |
| `lib/observe/episode-detector.ts` | 평가 직후 cheap LLM call로 significant moment 감지 → memory_moments insert |

**Memory (state update + 장기)**
| `lib/memory/semantic-summarizer.ts` | weekly/monthly narrative 생성 (기존 NarrativeWeaver Tier A/B) |
| `lib/memory/identity-distiller.ts` | 분기 learner_profiles 갱신 + quarterly reflection letter |
| `lib/memory/narrative-loader.ts` | 최근 narrative entry 조회 + 학생-facing 1인칭 paraphrase |
| `lib/memory/moments-loader.ts` | memory_moments callback 선택 로직 (surfaced_count + age 가중) |

**Copy / Demo**
| `lib/copy/companion-voice.ts` | Voice charter string export + 금지/권장 어휘 매핑 |
| `lib/demo-articles.ts` | Jiyool/Hayool용 demo 아티클 |
| `lib/demo-narratives.ts` | demo weekly/monthly/quarterly narratives |
| `lib/demo-moments.ts` | demo memory_moments (callback UI 검증용) |
| `lib/demo-profiles.ts` | demo learner_profiles |

**API**
| `app/api/articles/today/route.ts` | GET lazy 생성 + 조회 |
| `app/api/articles/comprehension/route.ts` | POST 답변 평가 |
| `app/api/articles/interests/route.ts` | POST 카테고리 시그널 |
| `app/api/narratives/route.ts` | GET 조회 + POST 강제 갱신 |
| `app/api/moments/route.ts` | GET callback용 moment 1개 추출. POST 학부모용 archive 조회 |

**UI**
| `components/article-reader.tsx` | 본문 렌더 + 어휘 툴팁 + TTS 낭독 버튼 |
| `components/comprehension-quiz.tsx` | 질문 1개씩 카드 + 즉시 AI 피드백 |
| `components/article-stage-tracker.tsx` | 4-stage 진행/잠금 표시 |
| `components/companion-memory-panel.tsx` | 학생 화면 상단 — weekly narrative ↔ memory callback 토글 |
| `components/growth-journal.tsx` | 학부모 evergreen journal — 분기/월/주 prose 타임라인 + "기억할 만한 순간들" anchor |

### 수정
| 파일 | 변경 내용 |
|---|---|
| `lib/types.ts` | 신규 타입 추가 (`DailyArticle`, `ComprehensionQuestion` 등). `StudentDashboard.todayArticle` 필드 추가 |
| `lib/dashboard.ts` | `loadDashboardData`에서 article을 함께 로드 (lazy 트리거는 클라이언트가 함). `ensureDefaultStudent` 후 `student_interests` seed |
| `lib/openai.ts` | `evaluateSpeakingTranscript` / `evaluateLearningEvent`에 `articleContext` 인자 추가 — 평가 시 학생 답변이 article을 얼마나 활용했는지 반영. 신규 `evaluateComprehensionAnswer` 함수 추가 |
| `lib/task-generator.ts` | **deprecation**: `generateAdaptiveTask`는 article 없는 fallback 경로에만 남겨두고, 일상 사용은 article의 `speakingPrompt`/`writingPrompt`로 대체 |
| `lib/demo-data.ts` | `todayArticle`을 demo dashboard에 추가 (`demo-articles.ts` 임포트). 기존 `todayTask`/`speakingTask`/`writingTask`는 article에서 파생 |
| `app/api/learning-events/route.ts` | request body에 `articleId` 받기, learning_events에 article_id 저장, 평가 시 article context 전달 |
| `app/api/speaking-attempts/route.ts` | 동일하게 articleId 처리 |
| `components/family-tutor-app.tsx` | Play 탭을 4-stage 흐름으로 재구성. `WorkspaceHeader`는 article title + category chip 표시. **상단에 `CompanionMemoryPanel` 고정 노출**. `PlayView`의 speaking/writing 패널을 article context strip이 위에 붙은 형태로 변환. Quest/Score/Submit 등 평가 어휘를 `companion-voice.ts`의 `companionVoice()` 헬퍼로 치환 |
| `components/parent-child-detail.tsx` | 기존 Overview의 상단을 **`GrowthJournal`로 교체** — AI development summary 1단락이 아니라, 분기/월/주 prose 타임라인. 점수 차트와 stat card는 그 아래 보조 위치로. 신규 "Reading" 섹션 — 일별 article 목록, 카테고리 분포 차트, 독해 답변 archive |

---

## UI String Mapping (Voice Charter의 concrete 적용)

Voice charter는 philosophy이고, 아래 표는 그것의 concrete 적용. 학생-facing UI string은 모두 `companionVoice()` 헬퍼를 거치고, 헬퍼는 `lib/copy/companion-voice.ts`의 mapping을 따른다. 학부모 화면은 헬퍼를 호출하지 않아 정량/평가 어휘를 그대로 유지 (부모는 정확한 진단을 원함).

| 기존 (평가 톤) | 신규 (동반자 톤) — 학생 화면 |
|---|---|
| Quest / Today's quest | 오늘의 이야기 / Today's read |
| Finish Quest / Submit | 같이 마무리하기 / 보여주기 |
| Your score 78 | 오늘 우리가 함께 푼 줄: "…" (점수 숫자는 micro-pill로 작게) |
| Lesson complete | 오늘의 한 페이지 완성 |
| Evaluation | Omelet의 메모 |
| needs_practice | 다음에 같이 해볼 것 |
| Reward · +1 | 함께 자란 흔적 +1 |
| Attempt history | 같이 말해본 기록 |

데이터 모델은 변경 없음 — 컴포넌트 안의 string literal만 변환된다.

### CompanionMemoryPanel (학생 화면 상단 고정)

Weekly narrative paraphrase + memory_moment callback이 토글되는 패널.

```
┌─────────────────────────────────────────────┐
│ Omelet이 기억하는 것                        │
│                                             │
│ "지난주에 네가 'because'를 두 번 연달아     │
│  쓴 거 기억해. 오늘은 그 다음 단계로 가      │
│  보자."                                     │
│                                             │
│             — 너와 함께한 47일째            │
└─────────────────────────────────────────────┘
```

또는 memory_moment callback 모드:

```
┌─────────────────────────────────────────────┐
│ Omelet이 기억하는 것                        │
│                                             │
│ "3개월 전 오늘, 네가 처음으로                │
│  'I like cats because they are quiet'       │
│  라고 쓴 날이야. 그때보다 지금 너의           │
│  문장은 훨씬 길어졌어."                      │
│                                             │
│             — 너와 함께한 134일째            │
└─────────────────────────────────────────────┘
```

"너와 함께한 N일째" 카운터는 `students.created_at` 기준 단순 계산.

---

## Curation Pipeline Logic

### 카테고리 다양성 보장
`student_interests.engagement_score`로 가중치, 그러나 다음 제약을 강제:
1. 어제와 같은 카테고리 금지
2. 7일 내 한 번도 안 나온 카테고리가 있으면 그 중 하나를 우선 선택 (engagement_score 무시)
3. 그 외에는 `engagement_score` softmax 샘플링

이 로직은 Agent 1 (Curator) 호출 전 `lib/policy/article-loader.ts`에서 후보 카테고리 풀을 미리 좁혀서 prompt에 주입.

### engagement_score 업데이트
- Stage 4(Write)까지 완료: +0.08
- Comprehension만 완료: +0.04
- 본문만 읽고 이탈: +0.01
- 7일간 안 보이면 0.5 쪽으로 감쇠(decay 0.02/day)

### Lazy 생성 UX
- `/student` 페이지 즉시 렌더 (article 영역은 skeleton)
- 마운트 시 `GET /api/articles/today` 호출
- 서버: 오늘 row 있으면 즉시 반환, 없으면 curator 체인 실행 (10-30초 예상) → 저장 → 반환
- 클라이언트: 로딩 중 "오늘 아침의 글을 골라오고 있어요…" + curator step별 progress 표시 (선택)
- 실패 시 demo article로 폴백

### Narrative 트리거 로직

모두 lazy. 별도 cron 없음.

| Tier | 트리거 시점 | Owner |
|---|---|---|
| weekly | 학생 첫 접속 시, 직전 weekly entry의 period_end가 7일+ 지났을 때 | `GET /api/narratives` → 필요 시 생성 |
| monthly | 학부모 첫 접속 시, 직전 monthly chapter가 30일+ 지났을 때 | `GET /api/narratives?role=parent` → 필요 시 생성 |
| quarterly | 학부모 화면에서 직전 quarterly가 90일+ 지났을 때 (옵션: 명시적 "이번 분기 letter 받기" 버튼) | 동일 |

각 생성 후 결과를 `growth_narratives`에 저장 → 다음 호출은 캐시 히트.

학생-facing `CompanionMemoryPanel`은 항상 최신 weekly entry의 body를 1인칭으로 paraphrase해서 보여준다 (paraphrase는 `narrative-loader.ts`의 가벼운 함수로 처리 — OpenAI 호출 없이 prefix 교체만 해도 충분).

---

## Existing Code to Reuse

| 기능 | 위치 | 재사용 방식 |
|---|---|---|
| OpenAI Responses API 호출 패턴 | `lib/openai.ts:48-187` (`evaluateLearningEvent`), `lib/task-generator.ts:52-158` (`callOpenAIForTask`) | 동일한 fetch 구조 + `extractOutputText` 헬퍼를 `article-curator.ts`에서 그대로 활용 |
| Demo fallback 패턴 | `lib/openai.ts:673-732`, `lib/task-generator.ts:209-291` | `article-curator.ts`의 키-없음 분기에 동일 패턴 적용 |
| TTS 엔드포인트 | `app/api/tts/route.ts` | `ArticleReader`의 어휘/본문 낭독에 그대로 호출 |
| Skill state / observation 업데이트 | `app/api/learning-events/route.ts:62-102` | article 기반 평가도 동일 경로로 흐름. article_id만 추가 |
| Development summary 패턴 | `lib/openai.ts:895-996` (`summarizeStudentDevelopment`) | `semantic-summarizer.ts`의 weekly tier가 이 함수의 진화형. 동일 fetch 패턴 + 더 풍부한 input (직전 narrative tail 포함) |
| Parent summary API | `app/api/parent/student-summary/route.ts` | `/api/narratives`로 흡수. 기존 endpoint는 deprecated 후 narrative monthly chapter로 응답 |
| Daily task 캐시 | `lib/task-generator.ts:15-31` | `article-loader.ts`도 같은 in-memory 캐시 전략 (TTL=하루) |
| HMAC 세션 / role 가드 | `lib/auth.ts:67-87` | 신규 API 라우트도 동일하게 `rejectWithoutFamilySession` 사용 |
| Supabase admin client | `lib/supabase.ts` | 그대로 사용 |
| Score history 차트 | `components/score-history.tsx` | 학부모 Reading 섹션의 카테고리 분포 시각화에 비슷한 SVG 패턴 차용 |

---

## Implementation Order

### Phase 0 — Publish architecture (먼저)
0a. 이 문서를 `docs/architecture.md`로 publish.
0b. Voice essence/금지/권장만 발췌해 `docs/companion-voice.md`로 분리 publish.
0c. README.md 상단에 두 문서 링크 추가.

### Phase 1 — Article-driven daily flow
1. **Migration + types** — `0003_articles.sql`, `lib/types.ts` 업데이트
2. **Demo articles** — `lib/demo-articles.ts` + `lib/demo-data.ts` 연결. 키 없이도 동작 확인
3. **Curator chain** — `lib/policy/article-curator.ts` 4-agent 체인 (skill-graph·learner-profile 컨텍스트는 빈 값으로 시작)
4. **Article loader + API** — `lib/policy/article-loader.ts`, `app/api/articles/today/route.ts`
5. **Comprehension evaluator** — `lib/observe/comprehension-evaluator.ts`, `app/api/articles/comprehension/route.ts`
6. **UI: Stage 1+2** — `article-reader`, `comprehension-quiz`, `article-stage-tracker`
7. **family-tutor-app.tsx 통합** — Play 탭 4-stage 재구성
8. **Speaking/Writing API에 article context 전달**
9. **Interests + rotation** — engagement_score hook

### Phase 2 — Longitudinal narrative + companion framing
10. **Migration 0004 (narratives)** + 타입 추가
11. **Voice charter** — `lib/copy/companion-voice.ts` (charter string + 금지/권장 매핑). 평가 prompts와 학생 컴포넌트에 inject
12. **SemanticSummarizer (weekly)** — `lib/memory/semantic-summarizer.ts` + demo narratives + `lib/memory/narrative-loader.ts`
13. **Narrative API + CompanionMemoryPanel** — 학생 화면 상단 고정
14. **Parent GrowthJournal** — `parent-child-detail.tsx` Overview 교체. `/api/parent/student-summary`는 `/api/narratives`로 흡수
15. **SemanticSummarizer (monthly/quarterly demo)** — 실제 생성은 데이터 누적 후

### Phase 3 — Skill graph
16. **Migration 0005 (skill_edges + seed)** — 20-30개 초기 edge seed
17. **`lib/policy/skill-graph.ts`** — `nextUnlockableEdges()` 등 핵심 쿼리
18. **Curator Agent 1 + Question Designer Agent 4 통합** — skill-graph next-edge 컨텍스트 주입
19. **SemanticSummarizer 통합** — "X를 통해 Y로 가는 길이 열렸어" 서사 패턴 활성화

### Phase 4 — Episodic + Identity (companion 정체성 완성)
20. **Migration 0006 (memory_moments + learner_profiles)**
21. **EpisodeDetector** — `lib/observe/episode-detector.ts`. 평가 직후 hook (learning-events + speaking-attempts 라우트에 추가)
22. **Moments API + 학생 callback** — `app/api/moments`, `CompanionMemoryPanel`이 narrative ↔ moment 토글
23. **IdentityDistiller** — `lib/memory/identity-distiller.ts`. 분기 단위 또는 시그널 누적 시 learner_profiles 갱신
24. **Personalization 적용** — Article Writer/Question Designer가 learner_profile을 읽어 angle 조정
25. **GrowthJournal에 "기억할 만한 순간들" 타임라인 추가**

### Phase 5 — 운영·품질 가드
26. **CI grep check** — 학생 컴포넌트에 금지 어휘 검출 (companion-voice 위반)
27. **Raw memory compaction policy** — 90일+ raw observation은 cold archive로 이동, semantic layer만 활성 (이후 SemanticSummarizer는 semantic만 읽음)
28. **Source-grounding 감사** — narrative와 moment의 `source_signals`가 실제 evidence id로 연결되는지 주기적 검증

각 phase 끝에서 Verification 수행. Phase 0/1은 즉시, Phase 2-4는 데이터 누적/기능 안정화 후 점진.

---

## Verification

### Demo 모드 (OpenAI/Supabase 키 없음)
1. `npm run dev`
2. `/login`에서 Jiyool로 진입
3. Play 탭에 demo article (`demo-articles.ts`의 1개)이 즉시 표시되는지 확인
4. Read → Comprehension 답변 → AI 피드백 (demo evaluator) → Speak 잠금 해제 → 녹음 → Write 잠금 해제 → 작성 → 보상 지급까지 한 사이클
5. Hayool로 로그인 시 다른 카테고리/난이도의 article이 보이는지 확인

### Live 모드 (OpenAI 키 + Supabase)
1. `.env.local`에 `OPENAI_API_KEY` 설정, supabase migration 모두 적용
2. Jiyool로 진입 → skeleton + "오늘의 글을 골라오는 중" → 15-30초 후 article 표시
3. Network 탭에서 OpenAI 호출 4회 발생 확인 (curator/researcher/writer/question)
4. `articles` 테이블에 row 1개, `comprehension_questions` JSON에 3-5개 질문 확인
5. Comprehension 답변 후 `reading_attempts` row 생성 확인
6. Speaking 녹음 → `speaking_attempts.article_id`가 채워지는지 확인
7. Writing 제출 → `learning_events.article_id`가 채워지는지 확인
8. 다음 날 다시 로그인 → 새 article 생성, 어제와 다른 카테고리인지 확인 (`category_rotation` enforcement)
9. 7일간 반복하여 8개 카테고리 모두 한 번 이상 노출되는지 검증

### Parent 뷰 (Phase 1)
1. parent@example.com 로그인 → Jiyool 선택 → Reading 섹션
2. 일별 article 목록 + 카테고리 분포 (예: pie chart) 표시 확인
3. 특정 article 클릭 → 본문 + 학생 답변 archive 확인

### Narrative 레이어 (Phase 2)
1. Demo 모드에서 Jiyool로 진입 → `CompanionMemoryPanel`이 상단에 표시 + "지난주에 네가 …" 톤의 문구 확인
2. 학생 UI 어디에도 "Quest/Score/Submit/Evaluation" 등 평가 어휘가 보이지 않는지 grep으로 검증
3. 학부모 모드에서 Overview 상단에 `GrowthJournal` 분기/월/주 prose 타임라인이 보이는지 확인. 정량 stat은 그 아래
4. Live 모드: 7일+ 사용 후 새 weekly entry가 생성되어 `growth_narratives` row가 늘어나는지 확인
5. 30일+ 사용 후 학부모 첫 접속 시 monthly chapter가 생성되어 표시되는지 확인
6. Demo 모드에서 monthly/quarterly demo entry로 GrowthJournal 다단계 렌더링 시각적 검증

### Skill Graph (Phase 3)
1. Seed migration 적용 후 `skill_edges` 테이블에 20-30 row 확인
2. `nextUnlockableEdges(jiyoolSkillStates)` 단위 호출 → because_usage가 strong이면 multi_clause_sentence가 후보로 나오는지 확인
3. Article 생성 시 Curator 컨텍스트에 next-edge 포함되는지 prompt log 검증
4. SemanticSummarizer의 weekly entry에 "X를 통해 Y로 가는 길" 같은 graph-based 서사가 자연스럽게 나오는지 prose 검증

### Episodic + Identity (Phase 4)
1. Live 모드에서 학생이 평소보다 긴 답변/새로운 sentence 패턴을 입력 → EpisodeDetector가 memory_moments에 row insert하는지 확인
2. `app/api/moments` GET → 가장 적게 surface된 1+개월 전 moment 반환 확인
3. `CompanionMemoryPanel`이 narrative와 moment를 토글 노출 (UI 시각 검증)
4. Demo 모드에서 demo learner_profile 적용 → `imaginative` Jiyool과 `factual` Hayool의 같은 카테고리 article body가 다른 angle인지 확인
5. 분기 시뮬레이션 (demo): IdentityDistiller가 demo profile을 갱신하는 path 동작 확인

### 운영·품질 (Phase 5)
1. `npm run check:voice` (또는 CI step) — 학생 컴포넌트에 금지 어휘 0건
2. Cold archive job (수동 실행) — 90일 이상 raw observation이 별도 테이블/JSON dump로 이동, 활성 쿼리에서 제외되는지 확인
3. Narrative source-grounding 감사: 무작위 추출한 narrative entry 1개를 골라, source_signals에 명시된 observation_id들이 실제 존재하고 narrative 본문 주장과 일관되는지 수동 확인

---

## Risks & Mitigations

| 위험 | 완화 |
|---|---|
| Lazy 생성 첫 로딩 15-30초 지연 | Skeleton + progressive step indicator. 실패 시 demo article 즉시 폴백 |
| AI 생성 아티클의 사실 부정확 | Agent 2 (Researcher) 단계에서 citation 강제 + Agent 3 prompt에 "uncertain한 사실은 'some sources say'로 hedge하라" 규칙 |
| 카테고리 다양성 알고리즘이 학생 선호 무시 | Engagement score는 가중치이지 결정자가 아님. 명시적 force-cover 규칙 우선 |
| OpenAI 4회 호출 비용 누적 | gpt-5.4-mini 기준 article당 약 $0.02-0.05. 2명 × 30일 ≈ $1-3/월. 수용 가능 |
| Article의 speaking/writing prompt가 너무 비슷해짐 | Agent 4 prompt에 기존 task-generator.ts의 "speaking ≠ writing" 분기 규칙 그대로 이식 |
| 학생이 본문을 안 읽고 comprehension으로 넘어감 | Stage gating은 가볍게 (강제 대기 X), 대신 comprehension 평가에서 "본문 인용/참조 여부"를 점수에 반영 |
| 초기 narrative는 데이터 부족으로 일반론적 | weekly tier는 데이터 7일 이상일 때만 활성화. 그 전에는 `CompanionMemoryPanel`이 "너랑 알아가는 중이야, 며칠만 더 같이 하자" 같은 onboarding 톤 |
| Narrative가 거짓 진보를 서사화함 (hallucinated growth) | SemanticSummarizer prompt에 "source_signals에 명시된 evidence만 인용. 새 패턴 발명 금지" 규칙. body 텍스트의 모든 주장은 observation/snapshot ID로 추적 가능해야 함. system instruction에 "you are summarizing, not extrapolating" 명시 |
| Companion 톤이 부모에게 "데이터가 부실해 보임" 인상 | 학생 화면만 동반자 톤, 학부모 화면은 정량 + narrative 둘 다. 부모 GrowthJournal 안에 "→ 자세히 보기" 토글로 evidence (observation IDs, snapshot 점수) 확인 가능 |
| Voice helper 적용 누락 발생 | ESLint custom rule 또는 grep CI check로 학생 컴포넌트에서 금지 어휘 (Quest/Score/Submit/Evaluation/Reward as bare word) 검출 |
| `lib/openai.ts` 1015줄이 더 비대해짐 | 신규 함수는 처음부터 `lib/observe/` `lib/memory/` 신규 디렉토리에 작성. 기존 함수 이관은 별도 PR 자리 비워둠 |
| Skill graph seed가 영어 발달 토폴로지를 잘못 모델링 | 초기 seed는 보수적으로 (이미 정설로 받아들여지는 edge만, 예: because→multi-clause). strength는 평가 evidence로 보정. edge 추가는 migration으로 추적 |
| EpisodeDetector가 흔한 답변을 매번 significant로 mis-flag | precision 우선 prompt — "지난 14일 동안 본 적 없는 패턴일 때만 true". `surfaced_count`/duplicate check로 같은 moment 중복 생성 방지. 학부모 UI에서 manual delete 가능 |
| LearnerProfile이 학생을 stereotype으로 가두기 | 모든 dimension은 nullable + "확신 부족시 null 유지" 규칙. evidence_signals로 근거 추적. 분기마다 재평가하며 변할 수 있음을 보장 |
| Memory layer 폭증 (Raw 데이터 누적) | Phase 5에서 90일+ raw cold archive 정책. Episodic/Semantic/Identity는 압축본이므로 무한 보존 가능 |
| Voice charter 위반이 invisible하게 누적 | `lib/copy/companion-voice.ts`가 모든 student-facing prompt의 첫 줄에 charter 전문 inject. CI grep + 분기마다 학생 화면 텍스트 manual 감사 |
| Phase 단계가 많아 priority 흐려짐 | Phase 1까지가 "사용 가능한 MVP". Phase 2-4는 시스템 정체성을 완성하지만 각 phase 끝에서 사용자에게 stable 상태로 ship 가능하도록 분리 |
