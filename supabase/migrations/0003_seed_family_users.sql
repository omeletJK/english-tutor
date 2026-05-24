-- Seed default family users so the app can resolve logins from DB instead of
-- from JIYOOL_EMAIL/HAYOOL_EMAIL/PARENT_EMAIL env vars. Adding a new family
-- member later is now a single INSERT instead of an env + redeploy.
--
-- After this migration the runtime contract is:
--   login → resolveUserByEmail() queries family_users by email
--   demo-mode (no Supabase) → still falls back to env-based findDemoUser

insert into public.family_users (email, role, display_name)
values
  ('jiyool@example.com', 'student', 'Jiyool'),
  ('hayool@example.com', 'student', 'Hayool'),
  ('parent@example.com', 'parent', 'Parent')
on conflict (email) do nothing;

-- If a student row already exists with the same email (e.g. created by an
-- earlier local-dev login before this migration), link it to the family_users
-- row so the runtime studentId resolves to the real student UUID.
update public.family_users fu
set student_id = s.id
from public.students s
where fu.email = s.email
  and fu.student_id is null;
