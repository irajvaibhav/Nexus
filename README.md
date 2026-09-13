# NEXUS

Your AI life-administration agent. Upload your documents once — NEXUS reads them,
tracks what's expiring, answers questions in plain language, fills out forms, and
tells you exactly what's missing when it can't.

## What it does

- **Sign in with Google or email** — both journeys are always visible on the auth
  screens, and the edge cases are handled in words: unknown email at sign-in,
  already-registered email at sign-up, unconfirmed email, failed Google flow.
- **Document vault** — upload IDs, licences, insurance, bank statements, certificates.
  Uploads show real progress, then every processing stage as it happens
  (scan → extract → analyse → index → ready), ending with the category choice. A
  failed read is marked and can be retried. Gemini extracts every field,
  categorizes the document, and makes it searchable. Each field carries the
  model's own confidence and the page it came from, so a guess never looks like
  a fact.
- **Document detail & correction** — every document opens to a preview alongside the
  details NEXUS pulled out. Values are editable inline, and confirming one marks it
  certain so it leaves the review queue.
- **Search, filters & duplicates** — search across extracted values (not just file
  names), filter by health status, and get a replace-or-keep-both prompt when a
  second document of the same type is uploaded.
- **Document health** — each document resolves to a single state: reading, couldn't
  read, expired, expiring, needs review, or verified. *Needs review* means NEXUS
  scored some extracted values as uncertain (blurry scan, handwriting); because
  those values feed Ask NEXUS and form-filling, the document stays flagged until
  you confirm or correct them — one click confirms them all.
- **Ask NEXUS** — a chat interface grounded in your own documents (retrieval-augmented,
  not a generic chatbot). Ask "what's my PAN number" or "what documents do I need for
  a car loan" and it answers from what you've actually uploaded, and says plainly
  when something's missing instead of guessing. Ask by typing, speaking, attaching a
  file or taking a photo — a photo is answered against the details already extracted
  from your documents. Source chips open the document an answer came from, and
  Aadhaar/PAN/account-shaped values stay masked until tapped.
- **Reminders** — expiry dates pulled automatically from your documents, surfaced
  before they lapse.
- **Conflict detection** — flags when two documents disagree on a name, date, or
  number that should match.
- **Scan & Fill** — photograph or upload a blank form and walk it through
  scan → review → preview → export. Every matched field is editable, low-confidence
  matches are flagged with the model's score, and the PDF is filled from the values
  you reviewed. Fields that exist on the page but have no real PDF form field behind
  them are called out, with their values offered for copying, rather than silently
  dropped. The final step downloads the filled PDF — the thing you print, sign, or
  upload to whoever asked for the form — and can save a copy back into Documents.
- **Renewal planner** — on request, NEXUS builds a prioritized plan for upcoming
  renewals, using weather and (if connected) your Google Calendar's free/busy to
  suggest a good day — and only creates tasks after you approve.
- **Google Calendar integration** — connect your calendar so NEXUS can check you're
  actually free before suggesting a day, and add renewal tasks straight to it.
  Settings verifies the connection live with Google, shows which account is
  connected, and can add a test event with a link to open it in Google Calendar.
- **Weather** — Home shows the local forecast with proper loading, error and
  retry states, and the best upcoming day for errands. Set your city by hand or
  with "Use my location".
- **Home that leads with what matters** — Home opens with a full-width Ask NEXUS
  box (also reachable from the header on every page), then the single most
  pressing item: conflicting details first, then an approaching expiry, then a
  document awaiting review, followed by quick actions.
- **Tasks & Activity log** — a running to-do list and a full history of everything
  NEXUS has done on your behalf, labelled by who did it (you or NEXUS) and filterable.

## Permissions and your data

The agent runs at one of four levels, set in Settings and **enforced server-side**,
not just in the UI:

| Level | NEXUS may |
| --- | --- |
| Read | Read your documents and answer questions |
| Recommend | Also generate renewal plans |
| Prepare | Also create tasks from an approved plan |
| Execute | Also write events to your Google Calendar |

A route that needs more than the current level refuses and says which setting to
change. Settings also spells out what NEXUS stores and why, and can export
everything it has extracted about you as JSON (document files are downloaded
individually; derived embeddings are omitted). Deleting a document clears its
reminders, extracted fields, chunks and entity links with it — tasks survive on
purpose and only lose the link.

## Stack

- [Next.js](https://nextjs.org) (App Router, Turbopack) + TypeScript + Tailwind CSS v4
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, all with row-level
  security so every user only ever sees their own data
- [Google Gemini](https://ai.google.dev) — document understanding, form matching,
  chat, and embeddings for retrieval
- [pdf-lib](https://pdf-lib.js.org) — reading and filling real AcroForm PDF fields
- [Open-Meteo](https://open-meteo.com) — free weather forecasts, no API key
- Google Calendar API — OAuth-based free/busy checks and event creation
- Web Speech API and `getUserMedia` for voice and camera input (browser-native,
  and only available on a secure origin — localhost or https)

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

### Google sign-in

Enable the Google provider in Supabase (Authentication → Providers) with the same
Google Cloud OAuth client, and add `http://localhost:3000/auth/callback` (and the
production equivalent) to Supabase's Redirect URLs. Email/password keeps working
without it.

### Google Calendar

Optional — the rest of the app works without it. The OAuth client needs the
`calendar.events`, `calendar.freebusy` and `userinfo.email` scopes on its consent
screen, and `GOOGLE_REDIRECT_URI` must match an Authorized redirect URI. Users
who connected before the email scope was added see a "reconnect" hint in
Settings. See `app/api/auth/google/` for the flow.

## Project structure

```
app/
  login/, signup/   Email + Google auth, with a shared shell in components/auth-shell.tsx
  auth/callback/    Supabase OAuth code exchange; creates the profile for Google users
  dashboard/        Home, Documents, Ask, Reminders, Scan & Fill, Tasks, Activity, Settings
    documents/[id]/  Per-document preview, extracted details, inline correction
  api/
    process-document/  Streams processing stages while extracting fields, deadlines, entities
    chat/               RAG-grounded Q&A over your documents, text or image
    scan-form/          Form-field matching
    scan-form/fill/     Fills the PDF from the reviewed values at export time
    agent/              Renewal plan generation and approval
    auth/google/         Calendar OAuth connect/callback
    calendar/            Calendar status, disconnect, event creation
    account/export/      Full JSON export of everything NEXUS holds
lib/
  gemini.ts          Gemini prompts: extraction, form analysis, chat, plans
  upload.ts          Upload with progress, and the processing-stage stream reader
  permissions.ts     Agent permission levels and server-side checks
  doc-status.ts      Derived document health (expired / expiring / needs review)
  sensitive.ts       Detecting and masking Aadhaar/PAN/account-shaped values
  pdf-form.ts        Writing reviewed values into AcroForm fields
  delete-document.ts Cascading document deletion
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
