# NEXUS

Your AI life-administration agent. Upload your documents once — NEXUS reads them,
tracks what's expiring, answers questions in plain language, fills out forms, and
tells you exactly what's missing when it can't.

## What it does

- **Document vault** — upload IDs, licences, insurance, bank statements, certificates.
  Gemini extracts every field, categorizes the document, and makes it searchable.
- **Ask NEXUS** — a chat interface grounded in your own documents (retrieval-augmented,
  not a generic chatbot). Ask "what's my PAN number" or "what documents do I need for
  a car loan" and it answers from what you've actually uploaded, and says plainly
  when something's missing instead of guessing.
- **Reminders** — expiry dates pulled automatically from your documents, surfaced
  before they lapse.
- **Conflict detection** — flags when two documents disagree on a name, date, or
  number that should match.
- **Scan & Fill** — photograph or upload a blank form; NEXUS matches its fields
  against your documents, fills a real fillable PDF where possible, and tells you
  which fields it couldn't find (and what kind of document would have them).
- **Renewal planner** — on request, NEXUS builds a prioritized plan for upcoming
  renewals, using weather and (if connected) your Google Calendar's free/busy to
  suggest a good day — and only creates tasks after you approve.
- **Google Calendar integration** — connect your calendar so NEXUS can check you're
  actually free before suggesting a day, and add renewal tasks straight to it.
- **Tasks & Activity log** — a running to-do list and a full history of everything
  NEXUS has done on your behalf.

## Stack

- [Next.js](https://nextjs.org) (App Router, Turbopack) + TypeScript + Tailwind CSS v4
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, all with row-level
  security so every user only ever sees their own data
- [Google Gemini](https://ai.google.dev) — document understanding, form matching,
  chat, and embeddings for retrieval
- [pdf-lib](https://pdf-lib.js.org) — reading and filling real AcroForm PDF fields
- [Open-Meteo](https://open-meteo.com) — free weather forecasts, no API key
- Google Calendar API — OAuth-based free/busy checks and event creation

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Google Calendar is optional — the rest of the app works without it. See
`app/api/auth/google/` for the OAuth flow if you're setting it up fresh.

## Project structure

```
app/
  dashboard/        Home, Documents, Ask, Reminders, Scan & Fill, Tasks, Activity, Settings
  api/
    process-document/  Extracts fields, deadlines, entities from an uploaded document
    chat/               RAG-grounded Q&A over your documents
    scan-form/          Form-field matching + PDF filling
    agent/              Renewal plan generation and approval
    auth/google/         Calendar OAuth connect/callback
    calendar/            Calendar status, disconnect, event creation
lib/
  gemini.ts          Gemini prompts: extraction, form analysis, chat, plans
  google-calendar.ts Google OAuth + Calendar API helpers
  weather.ts         Open-Meteo forecast helpers
  checklist.ts        "What documents do I need" question detection
  conflicts.ts         Cross-document conflict detection
```

## Deploying

Deploys cleanly to [Vercel](https://vercel.com) — connect the repo, add the
environment variables above, and deploy. If Google Calendar is enabled, add the
production callback URL to both `GOOGLE_REDIRECT_URI` and the OAuth client's
Authorized redirect URIs in Google Cloud Console.
