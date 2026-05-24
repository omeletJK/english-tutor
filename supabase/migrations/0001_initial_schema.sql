create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text not null unique,
  birth_year integer,
  cefr_level text not null default 'A1+',
  us_grade_level text not null default 'Grade 5',
  level_description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.family_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('student', 'parent')),
  student_id uuid references public.students(id) on delete set null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  task_date date not null,
  mode text not null check (mode in ('speaking', 'writing')),
  prompt text not null,
  target_skills text[] not null default '{}',
  reward_value integer not null default 1 check (reward_value > 0),
  generated_reason text not null default '',
  success_criteria text[] not null default '{}',
  status text not null default 'assigned' check (status in ('assigned', 'completed', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  task_id uuid references public.daily_tasks(id) on delete set null,
  mode text not null check (mode in ('speaking', 'writing')),
  topic text,
  raw_input text not null,
  summary text not null default '',
  feedback_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_id uuid references public.learning_events(id) on delete set null,
  type text not null,
  skill text not null,
  claim text not null,
  confidence numeric(4, 3) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  first_seen date not null default current_date,
  last_seen date not null default current_date,
  status text not null default 'active' check (status in ('active', 'superseded', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.skill_states (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill text not null,
  level text not null check (level in ('new', 'emerging', 'growing', 'strong')),
  score integer not null default 0 check (score >= 0 and score <= 100),
  signals text[] not null default '{}',
  next_targets text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (student_id, skill)
);

create table if not exists public.evaluation_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_id uuid references public.learning_events(id) on delete set null,
  mode text not null check (mode in ('speaking', 'writing')),
  overall_score integer not null check (overall_score >= 0 and overall_score <= 100),
  metrics jsonb not null default '[]'::jsonb,
  strengths text[] not null default '{}',
  needs_practice text[] not null default '{}',
  evaluated_at timestamptz not null default now()
);

create table if not exists public.speaking_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_id uuid references public.learning_events(id) on delete set null,
  topic text not null,
  transcript text not null,
  score integer not null check (score >= 0 and score <= 100),
  metrics jsonb not null default '[]'::jsonb,
  feedback_sections jsonb not null default '[]'::jsonb,
  reference_sentences jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memory_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_id uuid references public.learning_events(id) on delete set null,
  type text not null check (type in ('mistake', 'improvement', 'strategy', 'interest')),
  claim text not null,
  evidence text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.prize_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  reward_target integer not null check (reward_target > 0),
  status text not null default 'active' check (status in ('active', 'claimed', 'paused')),
  achieved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  source_type text not null check (source_type in ('daily_task', 'skill_milestone', 'parent_adjustment')),
  source_id uuid,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.skill_milestone_awards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_id uuid references public.learning_events(id) on delete set null,
  skill text not null,
  level text not null,
  reward_value integer not null default 5 check (reward_value > 0),
  awarded_at timestamptz not null default now(),
  unique (student_id, skill, level)
);

create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  trigger_type text not null check (trigger_type in ('attendance_count', 'score_growth')),
  target_value integer not null check (target_value > 0),
  reward_amount integer not null check (reward_amount > 0),
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  created_at timestamptz not null default now()
);

create index if not exists daily_tasks_student_date_idx on public.daily_tasks(student_id, task_date desc);
create index if not exists observations_student_status_idx on public.observations(student_id, status, last_seen desc);
create index if not exists reward_ledger_student_created_idx on public.reward_ledger(student_id, created_at desc);
create index if not exists skill_states_student_skill_idx on public.skill_states(student_id, skill);
create index if not exists skill_milestone_awards_student_idx on public.skill_milestone_awards(student_id, awarded_at desc);
create index if not exists family_users_email_idx on public.family_users(email);
create index if not exists evaluation_snapshots_student_idx on public.evaluation_snapshots(student_id, evaluated_at desc);
create index if not exists reward_rules_student_idx on public.reward_rules(student_id, status);
create index if not exists speaking_attempts_student_idx on public.speaking_attempts(student_id, created_at desc);
create index if not exists memory_notes_student_idx on public.memory_notes(student_id, created_at desc);

create or replace view public.student_reward_totals as
select
  student_id,
  coalesce(sum(amount), 0)::integer as reward_balance
from public.reward_ledger
group by student_id;

alter table public.students enable row level security;
alter table public.family_users enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.learning_events enable row level security;
alter table public.observations enable row level security;
alter table public.skill_states enable row level security;
alter table public.evaluation_snapshots enable row level security;
alter table public.speaking_attempts enable row level security;
alter table public.memory_notes enable row level security;
alter table public.prize_goals enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.skill_milestone_awards enable row level security;
alter table public.reward_rules enable row level security;

-- The private MVP writes through Next.js server routes using SUPABASE_SECRET_KEY.
-- Add authenticated-user policies later if the app grows beyond a single family.
