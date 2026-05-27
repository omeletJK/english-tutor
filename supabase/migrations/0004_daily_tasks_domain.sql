-- Add a domain tag to each generated task so the student UI can show which
-- subject the prompt was sampled from (science, ethics, nature, etc.).
-- Nullable because pre-existing rows weren't generated with this metadata.

alter table public.daily_tasks
  add column if not exists domain text;

comment on column public.daily_tasks.domain is
  'Curriculum domain the task was sampled from (e.g. "science & discovery"). NULL on legacy rows.';
