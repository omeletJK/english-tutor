-- Add description (목적) to reward_rules so parents can name the purpose
-- of each rule, not just its title.

alter table public.reward_rules
  add column if not exists description text not null default '';
