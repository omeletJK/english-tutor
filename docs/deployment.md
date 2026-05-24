# Deployment Guide

## 1. Supabase

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/migrations/0001_initial_schema.sql`.
4. Copy the project URL.
5. Copy a server-side secret key.

Use the new Supabase secret key if your project shows it. Legacy projects can
use the `service_role` key. Do not expose this key in client-side code.

## 2. OpenAI

1. Create an OpenAI API key.
2. Set a monthly usage limit.
3. Start with `OPENAI_EVALUATION_MODEL=gpt-5.4-mini` for faster lesson feedback.
4. Use `OPENAI_TTS_MODEL=gpt-4o-mini-tts` and `OPENAI_TTS_VOICE=marin` for natural sentence playback.

The app uses the Responses API from the server route only. If `OPENAI_API_KEY`
is missing, it falls back to deterministic demo feedback.

## 3. Vercel

Create a Vercel project from this repository and add these environment
variables:

```text
JIYOOL_EMAIL=jiyool@example.com
HAYOOL_EMAIL=hayool@example.com
PARENT_EMAIL=parent@example.com
SESSION_SECRET=random-long-string
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-secret-key
OPENAI_API_KEY=sk-proj-...
OPENAI_EVALUATION_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=marin
```

Deploy after the variables are saved.

## 4. Local Run

```bash
npm install
npm run dev -- --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000`.

## 5. Current Security Model

This is a private family MVP:

- The app accepts only configured family emails.
- Browser code never receives the Supabase secret key.
- Database writes go through Next.js API routes.
- Supabase Row Level Security is enabled; the server secret key bypasses it.

Before making this a public product, replace email-only login with Supabase Auth and add
per-user policies.
