# Multi-Tenant Family Migration — English Tutor

> Implementation plan for converting the single-family MVP into a multi-tenant
> family product. Captured 2026-05-25. Status: approved, not yet started.

## Context

The app at `/Users/jinkyoo/Documents/English Tutor` is a private single-family English learning MVP (Jiyool/Hayool/Parent hardcoded via env). The user wants to share it with other families. This plan converts it into a multi-tenant product where:

- Each family is a tenant (single Supabase DB + Row Level Security keyed on `family_id`).
- Parents sign up themselves via Supabase Auth magic links.
- Parents register children directly inside the dashboard (no child emails).
- Children log in via a 4-digit PIN on a child-picker screen.
- A family can have N parents and N children; parents can invite co-parents.

No real users exist yet — clean cutover, not a rolling migration. Demo data becomes a sample family for the dev environment.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Tenancy | Single Supabase DB + RLS by `family_id` |
| Parent auth | Supabase Auth, magic link only |
| Child auth | HMAC-signed server cookie (`child_session`), no Supabase user. Verified server-side; `family_id` in cookie is authoritative |
| Family shape | N parents + N children per family |
| Co-parent invite | Supabase `auth.admin.inviteUserByEmail` with custom redirect carrying invite token |
| Email transport | Supabase built-in (no Resend / no extra DNS) |
| `students` table | Keep (don't rename) — 12 child tables already FK to it. Add `family_id`, `pin_hash`, `pin_salt`, lockout columns |
| `family_users` table | Drop — replaced by `family_members` (parents only). Migration 0003 seed becomes irrelevant |

## Schema Migrations

Three new migration files:

### `0004_multitenant_core.sql`

```sql
create extension if not exists citext;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_code text not null unique,  -- 6-char base32 for child-login URLs
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','parent')) default 'parent',
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create index family_members_user_idx on public.family_members(user_id);

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email citext not null,
  token_hash text not null unique,    -- sha256 of raw token; raw only in email link
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
```

### `0005_add_family_id_to_tenant_tables.sql`

For each of the 13 existing tables (`students` plus its 12 children), in this order:

1. `alter table T add column family_id uuid references families(id) on delete cascade;`
2. Backfill: assign all existing rows to a single "Sample Family" created in this migration.
3. `alter table T alter column family_id set not null;`
4. `create index T_family_idx on T(family_id);`

Special cases:
- `students`: also `add column pin_hash text`, `pin_salt text`, `pin_failed_attempts int not null default 0`, `pin_locked_until timestamptz`, `avatar_seed text`. Drop `students_email_key` unique constraint and `email NOT NULL` (children have no email).
- Recreate `student_reward_totals` view to include `family_id`.
- Preserve existing unique constraints: `skill_states(student_id, skill)`, `skill_milestone_awards(student_id, skill, level)` (still correct because `student_id` is family-unique).

### `0006_rls_policies.sql`

Helper:
```sql
create or replace function public.user_family_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select family_id from family_members where user_id = auth.uid(); $$;
grant execute on public.user_family_ids() to authenticated;
```

For every tenant-scoped table:
```sql
alter table T force row level security;

create policy T_parent_rw on T for all to authenticated
  using (family_id in (select user_family_ids()))
  with check (family_id in (select user_family_ids()));
```

`families`: members can SELECT; only `role='owner'` can UPDATE. INSERT via service role during signup.
`family_members`: members can SELECT own family. INSERT/DELETE via service role only.
`family_invites`: parents can SELECT/INSERT/DELETE for their family.

**Children bypass RLS** — their requests use service role + `assertChildScope(cookie, requestedStudentId)` in `lib/tenant.ts`. RLS is the defense for parent-issued queries; app-level scoping is the defense for child-issued queries.

### `0007_drop_family_users.sql` (runs after M5)

```sql
drop index if exists family_users_email_idx;
drop table public.family_users cascade;
```

## Auth Model

### Parent
- Client: `supabase.auth.signInWithOtp({ email })` → magic-link email → callback page.
- Server: `@supabase/ssr` `createServerClient` reads JWT from cookies, exposes `auth.uid()`.
- All parent-facing queries go through the SSR client → RLS enforces family scope automatically.

### Child
- No Supabase user. `students.pin_hash` and `pin_salt` are scrypt-derived from a 4-digit PIN.
- `POST /api/session/child` body: `{ familyShortCode, studentId, pin }`. Server loads row, verifies PIN, sets cookie `child_session = base64(payload) + '.' + hmac(SESSION_SECRET, payload)` where payload = `{child_id, family_id, exp}`. Cookie: `HttpOnly; SameSite=Lax; Secure; maxAge=12h`.
- Rate limit: 5 wrong PIN attempts → 15-minute lockout via `pin_failed_attempts` + `pin_locked_until`.
- Child requests use service-role client + `assertChildScope` helper that asserts cookie's `family_id` matches every `student_id` touched. **Never accept `studentId` from request body when child cookie is present** — use the cookie value.

### Single helper

`lib/auth.ts` (rewritten) exports:
- `getCurrentPrincipal(): Promise<{kind:'parent', userId, familyIds[]} | {kind:'child', studentId, familyId} | null>`
- `assertParent()`, `assertChild()`, `assertAnyPrincipal()`
- `assertStudentInFamily(studentId)` — parent path, runs SELECT through SSR client (RLS catches violation)
- `assertChildScope(studentId)` — child path, compares to cookie

## Co-Parent Invite Flow

1. Parent in Family panel → enter email → `POST /api/family/invites`.
2. Server generates 32-byte random token, stores SHA256, calls `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: '${SITE_URL}/auth/invite-callback?token=${raw}' })`.
3. Invitee clicks email → Supabase verifies → redirects to callback.
4. Callback (server component): hash token → find unaccepted unexpired invite → insert `family_members(family_id, user_id=auth.uid(), role='parent')` → mark invite accepted → redirect `/parent`.
5. If a logged-in parent reaches `/parent` without a `family_members` row, they get sent to `/onboarding/create-family` (covers the "I signed up via raw magic link, no invite" case).

## Per-File Changes

### API routes

| File | Change |
|---|---|
| `app/api/session/route.ts` | Delete. Replace with `app/api/session/parent/route.ts` (DELETE only — `supabase.auth.signOut()`) and `app/api/session/child/route.ts` (POST verify PIN, DELETE child logout) |
| `app/api/learning-events/route.ts` | Use `assertAnyPrincipal`. Parent → `assertStudentInFamily(body.studentId)`. Child → use `principal.studentId` (ignore body). Add `family_id` to all inserts |
| `app/api/speaking-attempts/route.ts` | Same pattern |
| `app/api/reward-rules/route.ts` | Parent only. Move `studentId` from body to URL: `POST /api/students/[studentId]/reward-rules`. Run `assertStudentInFamily`. Closes existing bug at line 38 |
| `app/api/parent/student-summary/route.ts` | Parent only. `assertStudentInFamily(body.studentId)` |
| `app/api/tts/route.ts` | `assertAnyPrincipal()` |
| `app/api/family/children/route.ts` (new) | Parent only. POST creates `students` row in caller's family |
| `app/api/family/children/[id]/reset-pin/route.ts` (new) | Parent only. Resets pin_hash + salt |
| `app/api/family/invites/route.ts` (new) | Parent only. Creates invite + sends email |

### Pages

| File | Change |
|---|---|
| `app/page.tsx` | `assertAnyPrincipal()` → redirect parent → `/parent`, child → `/student` |
| `app/student/page.tsx` | `const c = await assertChild()` → `loadDashboardData(c)` |
| `app/parent/page.tsx` | `const p = await assertParent()` → `loadDashboardData(p)` |
| `app/parent/[studentId]/page.tsx` | After `assertParent()`, call `assertStudentInFamily(params.studentId)` |
| `app/login/page.tsx` | Full rewrite. Two panes: parent magic-link form + child picker (driven by `?family=` short code) |
| `app/onboarding/create-family/page.tsx` (new) | Form for first-time parent without family |
| `app/auth/invite-callback/page.tsx` (new) | Server component, attaches user to inviter's family |
| `app/parent/family/page.tsx` (new) | Members list, invite button, pending invites, short-code with copy-to-clipboard |

### Library

- `lib/auth.ts` → full rewrite per "Auth Model" above
- `lib/supabase-server.ts` (new) → `@supabase/ssr` createServerClient
- `lib/supabase.ts` → keep `getSupabaseAdmin` but rename to `getSupabaseServiceRole` and add JSDoc warning to only use for child PIN routes and admin jobs
- `lib/dashboard.ts` → parent path filters by `family_id in principal.familyIds` via SSR client (RLS enforces). Delete `ensureDefaultStudent`, `linkFamilyUserToStudent`
- `lib/demo-data.ts` → rename `demo-fixtures.ts`. Delete `findDemoUser`, `defaultFamilyEmails`, `listFamilyLoginEntries`. Keep `demoStudents` only as task-generator fallback data
- `lib/tenant.ts` (new) → `assertChildScope`, `assertStudentInFamily`
- `middleware.ts` (new, root) → refreshes parent JWT, redirects unauthenticated requests off `/student/*`, `/parent/*`, and POST `/api/*` (except `/api/session/*`)

## Ordered Milestones

| # | Scope | Days | Ships behind flag? |
|---|---|---|---|
| **M1** | Schema migrations 0004 + 0005 + 0006. App keeps working because service-role bypasses RLS and Sample Family is auto-assigned. No code changes yet | 1.5 | n/a |
| **M2** | Install `@supabase/ssr`. New `lib/supabase-server.ts`, new `lib/auth.ts` (parent path only), `middleware.ts`, rewrite `/login` parent pane, magic-link callback, `/onboarding/create-family`. Production: invite personal Gmail, prove magic link works end-to-end | 2.5 | `NEXT_PUBLIC_AUTH_V2=1` |
| **M3** | Switch `loadDashboardData` parent path to SSR client (RLS now actively enforces). Audit all 5 API routes for service-role usage; flip parent-only routes to SSR client. Run cross-tenant manual test (§Verification) | 1.0 | n/a |
| **M4** | Child PIN flow: pin_hash columns, `lib/tenant.ts`, `POST /api/session/child`, child picker UI on `/login`, `POST /api/family/children`, switch `/student` route to child principal. Delete `findDemoUser`/`listFamilyLoginEntries`/`ensureDefaultStudent` | 2.5 | flag off → on |
| **M5** | Co-parent invites: `family_invites` UI, invite-callback page, family panel, PIN reset modal. Drop migration 0007 (family_users). Delete demo env vars (`JIYOOL_EMAIL`/`HAYOOL_EMAIL`/`PARENT_EMAIL`) | 2.0 | n/a |
| **M6** | Hardening: scripted cross-tenant test suite (§Verification), rate limiting on `/api/session/child`, README + docs update, kill all remaining `body.studentId` trust paths | 1.5 | n/a |

**Total: ~11 dev days.**

## Verification

### Manual cross-tenant test (run before M3 ships)

1. Sign up Parent A (Gmail X) → Family A → register child A1 with PIN `1111`.
2. Sign up Parent B (Gmail Y) → Family B → register child B1 with PIN `2222`.
3. As Parent B, attempt `POST /api/parent/student-summary` with Parent A's child UUID → must return 404.
4. As Parent B, in SQL: `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub TO 'parent-B-uuid'; SELECT * FROM learning_events WHERE student_id='A1-uuid'` → 0 rows.
5. As child B1, tamper cookie to set `child_id = A1-uuid` (sign with leaked secret) → `POST /api/learning-events` must fail because cookie `family_id` is Family B and `assertChildScope` rejects.

### Scripted (CI, runs from M6 onward)

`scripts/test-tenant-isolation.ts`:
- Creates 2 families, 2 children each via service role.
- Acquires parent JWTs via `supabase.auth.admin.generateLink`.
- For all 13 tables, runs every cross-tenant SELECT/INSERT/UPDATE/DELETE combination and asserts denial.

### Static checks (CI)

- Grep `body.studentId` or `params.studentId` that reaches DB writes without `assertStudentInFamily` / `assertChildScope`.
- Grep `getSupabaseServiceRole()` callers; assert each is annotated with `// service-role:` reason comment.

## Critical Files

- [lib/auth.ts](../lib/auth.ts) — full rewrite
- [lib/dashboard.ts](../lib/dashboard.ts) — parent SSR client switch, drop `ensureDefaultStudent`
- [lib/supabase.ts](../lib/supabase.ts) — rename + warning
- [lib/demo-data.ts](../lib/demo-data.ts) — strip user-resolution, rename to demo-fixtures
- [supabase/migrations/0001_initial_schema.sql](../supabase/migrations/0001_initial_schema.sql) — read-only reference
- [supabase/migrations/0003_seed_family_users.sql](../supabase/migrations/0003_seed_family_users.sql) — superseded by 0007
- [app/login/page.tsx](../app/login/page.tsx) — full rewrite
- All 6 API routes under [app/api/](../app/api/)
- All 4 protected pages under [app/](../app/)

## Risks

1. **`@supabase/ssr` + Next.js 16 async cookies** — already required by Next 16. Verify `@supabase/ssr ≥ 0.5`. Fallback: roll own cookie adapter.
2. **Service-role footgun** — once RLS is on, any accidental `getSupabaseServiceRole()` use in a parent-facing read skips tenant scoping silently. Mitigation: rename, document, ESLint rule to require justification comment.
3. **PIN cookie secret rotation** kicks all children out. Documented; acceptable.
4. **Magic-link redirect Allow-list** — Supabase Dashboard → Auth → URL Configuration must be updated per deploy environment. Ship step in M2 runbook.
5. **`family_users` drop conflicts with migration 0003 seed** — handled by 0007 dropping the table after callers stop using it.
6. **PIN entropy** — 10k space is brute-forceable. Mitigated by lockout. Document that PIN is a "kid convenience", not a security boundary; the security boundary is family scope + cookie HMAC.
7. **Child UUIDs in localStorage** (`lib/avatar.ts:18` uses student_id as seed key) — minor info leak on shared device. Out of scope for this migration; flag in M6 notes.

## Out of Scope (explicit)

- Stripe / billing
- Family transfer / merger
- Child-initiated account deletion
- OAuth providers (can be added later as additional Supabase Auth provider)
- Multi-language UI
- Custom email templates (will use Supabase defaults until M5+)
