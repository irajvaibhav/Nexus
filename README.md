# NEXUS

**Your documents, remembered. Your deadlines, handled.**

NEXUS is a personal "life admin" assistant. You upload the documents you actually
have to deal with (ID cards, licences, insurance, bank statements, certificates),
and NEXUS reads them, remembers every detail, tracks what expires, answers
questions in plain language, fills in blank forms for you, and puts renewal dates
on your Google Calendar with reminders.

It is built for one person at a time: every row in the database is locked to the
user who created it, and nothing NEXUS does happens invisibly (there is an
Activity log of every action).

---

## Table of contents

1. [Who this is for](#who-this-is-for)
2. [A tour of the app](#a-tour-of-the-app)
   - [Landing page](#landing-page)
   - [Sign in / Sign up](#sign-in--sign-up)
   - [Home](#home)
   - [Vault (Documents)](#vault-documents)
   - [Document detail](#document-detail)
   - [Ask NEXUS](#ask-nexus)
   - [Reminders](#reminders)
   - [Scan & Fill](#scan--fill)
   - [Tasks](#tasks)
   - [Activity](#activity)
   - [Profile & Settings](#profile--settings)
3. [Typical workflows](#typical-workflows)
4. [Permissions and your data](#permissions-and-your-data)
5. [How it works under the hood](#how-it-works-under-the-hood)
6. [Tech stack](#tech-stack)
7. [Running it yourself](#running-it-yourself)
   - [Prerequisites](#prerequisites)
   - [Environment variables](#environment-variables)
   - [Supabase setup](#supabase-setup)
   - [Google sign-in](#google-sign-in)
   - [Google Calendar](#google-calendar)
   - [Gemini](#gemini)
8. [Deploying](#deploying)
9. [Project structure](#project-structure)
10. [API reference](#api-reference)
11. [Troubleshooting](#troubleshooting)

---

## Who this is for

Anyone who has a folder (or a drawer) of important paperwork and keeps forgetting
what is in it and when it runs out. Typical questions NEXUS answers:

- "When does my car insurance expire?"
- "What's my PAN number?"
- "What documents do I need for a car loan, and which ones am I missing?"
- "Which of my documents need attention this month?"

And typical jobs it does for you:

- Pulls the expiry date out of a policy and reminds you before it lapses.
- Notices that your name is spelled differently on two documents.
- Fills a blank form (PDF or photo) with details from your vault.
- Adds a renewal to Google Calendar with a popup the day before and an email a
  week out.

---

## A tour of the app

The app is a light, minimal interface with a blue accent. On desktop there is an
icon rail on the left (Home, Vault, Ask, Dates, Scan, Tasks, Activity, Settings,
your avatar). On phones the same navigation becomes a top bar plus a five-tab
bottom bar (Home, Vault, Ask, Dates, More). An "Ask NEXUS" pill sits at the
bottom of every page so you can ask a question from anywhere.

### Landing page

`/` explains the product with a live demo stage ("Good morning, Raj." followed by
a looping question-and-answer), a supported-document list, four feature cards
(Vault, Ask NEXUS, Reminders, Scan & Fill), a privacy section and a call to
action. **Login** and **Get started** are in the header.

### Sign in / Sign up

`/login` and `/signup` share one auth shell. Both offer:

- **Continue with Google** (one tap, no password).
- **Use email instead** (email + password).

The edge cases are handled in words rather than error codes: unknown email at
sign-in, already-registered email at sign-up, unconfirmed email, and a failed
Google flow all get a clear message with the next step.

### Home

`/dashboard` is the daily view:

1. **Date and greeting** ("Good morning, Raj").
2. **Ask NEXUS** box, front and centre, with a microphone for voice input.
3. **Needs attention** cards, most urgent first: conflicting details across
   documents, an approaching expiry, or a document awaiting review.
4. **Reminders (your week)**: a seven-day strip that merges the local weather
   forecast, your Google Calendar events and your document deadlines, with a
   one-line NEXUS insight (for example "Thursday is free and dry, a good day to
   renew the insurance"). If you have not set a city yet, you can type it or tap
   **Use my location** right there.
5. **Coming up**: the next few dates.
6. **Quick tiles**: Add a document, Ask, Scan & Fill, Reminders.
7. **Vault panel**: categories and your most recent documents.

### Vault (Documents)

`/dashboard/documents` is where everything lives.

- **+ Add document** (or drag and drop) opens the upload area. Supported: PDF,
  JPG, PNG. Uploads show real progress, then each processing stage as it
  happens: *scanning → extracting → analysing → indexing → ready*.
- When processing finishes, NEXUS asks which **category** the document belongs
  to (Essential Docs, Bank Docs, Vehicle, Non Essential Docs, or a custom
  category you create). Suggestions are pre-selected.
- **Duplicate check**: if you upload a second document of the same type (say, a
  new insurance policy), NEXUS asks whether to replace the old one or keep both.
- **Health status** for every document: *reading*, *couldn't read*, *expired*,
  *expiring*, *needs review*, or *verified*. A failed read can be retried.
- **Search** looks inside the extracted values, not just file names, so "HDFC"
  finds the bank statement even if the file is named `scan_0042.pdf`.
- **Filters** by category and by health.

**What "Needs review" means.** Every extracted value carries the model's own
confidence score. If some values scored low (blurry scan, handwriting, an
unusual layout), the document is flagged. Because those values feed Ask NEXUS
and Scan & Fill, it stays flagged until you confirm or correct them. One click
confirms them all.

### Document detail

`/dashboard/documents/[id]` shows the file preview alongside every detail NEXUS
pulled out (name, numbers, dates, addresses…), each with its confidence and the
page it came from. Values are editable inline; confirming one marks it certain.
Sensitive values (Aadhaar, PAN, account numbers) are masked until tapped.
Deleting a document also clears its reminders, fields, search index and entity
links.

### Ask NEXUS

`/dashboard/ask` is a chat grounded in your own documents, not a general
chatbot.

- Ask by **typing**, **speaking** (microphone), **attaching a file**, or
  **taking a photo**. A photo is answered against the details already extracted
  from your documents (for example, photograph a form and ask "can I fill this
  from what you have?").
- Answers cite **source chips** that open the exact document they came from,
  but only when a document was actually used. Small talk and general questions
  get an instant, source-free reply.
- If something is missing, NEXUS says so plainly ("I don't have your passport
  yet") instead of guessing.
- "What documents do I need for X" questions return a checklist with a tick or
  cross against each item based on your vault.

### Reminders

`/dashboard/reminders` lists every date NEXUS found, one card per date:

- A coloured date tile (blue = fine, amber = within two weeks, rose = overdue).
- The title, a "6 days left" chip, and the source document.
- **Ask** (jump to Ask NEXUS about it), **Remind me** (add to Google Calendar
  with reminders), and ✓ to mark it done. Done items can be reopened.
- Tabs for *Active*, *Completed* and *All*.
- On request, NEXUS can build a **renewal plan**: a prioritised list of what to
  renew and a suggested day for each, using the weather and your free/busy
  calendar. Tasks are only created after you approve the plan.

### Scan & Fill

`/dashboard/scan` fills a blank form for you.

1. **Scan**: upload or photograph the empty form. NEXUS reads the field labels.
2. **Review**: every field is matched to a value from your vault. Each match is
   editable; low-confidence matches are flagged with the score.
3. **Preview**: see exactly what will be written.
4. **Download**: a filled PDF you can print, sign or send. If the PDF has real
   form fields they are filled in place; if it does not (a scanned image, for
   example), NEXUS appends a clean "Completed details" page listing every
   answer. You can also save a copy back into the vault.

### Tasks

`/dashboard/tasks` is a simple to-do list. The side panel suggests one-tap tasks
from your dates ("Renew car insurance").

### Activity

`/dashboard/activity` is a full history of everything that happened: uploads,
extractions, questions, plan approvals, calendar writes. Each entry says whether
**you** or **NEXUS** did it, and can be filtered.

### Profile & Settings

- `/dashboard/profile`: avatar, name, email, city, member-since, sign-in method,
  current permission level, and counts of documents / dates / tasks / questions.
- `/dashboard/settings`:
  - **Google Calendar**: connect, see which Google account is linked (verified
    live), send a test event, disconnect.
  - **Location**: city for the weather, or "Use my location".
  - **Permissions**: how much NEXUS may do on its own (see below).
  - **Your data**: export everything as JSON, or delete the account.
  - **Password** (email accounts).

---

## Typical workflows

**First day**

1. Sign up with Google (or email).
2. On Home, type your city (or tap *Use my location*) so the week view has
   weather.
3. Go to Vault → *+ Add document* → drop in your ID, licence, insurance and a
   bank statement. Watch the stages complete and pick a category for each.
4. If anything is marked *Needs review*, open it and confirm or fix the values.
5. Ask NEXUS: "what expires this year?"

**Renewing something**

1. Home shows "Car insurance expires in 12 days".
2. Tap *Remind me* → it lands on Google Calendar with a popup and email reminder.
3. When the new policy arrives, upload it. NEXUS spots the duplicate and offers
   to replace the old one. The reminder is updated from the new expiry date.

**Filling a form**

1. Scan & Fill → photograph the blank form.
2. Check the matched values, correct any that are wrong.
3. Download the filled PDF and send it.

---

## Permissions and your data

NEXUS runs at one of four levels, chosen in Settings and **enforced on the
server**, not just hidden in the UI:

| Level | NEXUS may |
| --- | --- |
| Read | Read your documents and answer questions |
| Recommend | Also generate renewal plans |
| Prepare | Also create tasks from a plan you approved |
| Execute | Also write events to your Google Calendar |

An API route that needs a higher level refuses and names the setting to change.

What is stored, and why:

| Data | Why |
| --- | --- |
| The uploaded file (private storage bucket) | Preview and re-processing |
| Extracted fields with confidence and page number | Answers, form filling, conflict checks |
| Text chunks with embeddings | Finding the right passage for a question |
| Deadlines | Reminders and the week view |
| Entities (people, organisations) and their document links | Cross-document questions |
| Chat messages | Conversation history |
| Google refresh token (only if you connect Calendar) | Creating events on your behalf |
| Activity log | So nothing happens invisibly |

Everything can be exported as one JSON file from Settings (files are downloaded
separately; embeddings are omitted). Deleting a document cascades to its
reminders, fields, chunks and entity links; tasks survive on purpose and only
lose the link. Deleting the account removes everything.

---

## How it works under the hood

**Upload and processing.** The browser uploads straight to Supabase Storage with
a progress bar, then calls `/api/process-document`, which streams NDJSON stage
events back while it works. Gemini (`gemini-3.5-flash`) reads the file, returns
structured fields with confidence and page numbers, the document type, any
expiry dates, and named entities. The text is chunked and embedded
(`gemini-embedding-001`) into `document_chunks` for retrieval. If anything
fails the document is marked `failed` and can be retried; a retry cleans the
earlier partial rows first.

**Ask NEXUS (retrieval-augmented generation).** The question is embedded and
matched against your chunks with a `match_documents` vector search (pgvector),
merged with chunks from documents named in the question, and sent to a fast,
no-thinking model (`gemini-3.1-flash-lite`) with instructions to answer only
from what it was given. The model marks which sources it actually used so the
UI only shows relevant chips. Small talk short-circuits without touching the
vault. Photos go to the vision model with your extracted fields as context.
Every turn is logged after the response is sent.

**Health and review.** `lib/doc-status.ts` folds a document's status, expiry
dates and lowest field confidence into one health state.

**Conflicts.** `lib/conflicts.ts` compares fields that should agree across
documents (name, date of birth, ID numbers) and surfaces mismatches on Home.

**Scan & Fill.** `/api/scan-form` sends the blank form to Gemini with the list of
values in your vault and gets back a field-to-value mapping with confidence.
`/api/scan-form/fill` then uses `pdf-lib` to write the reviewed values into
AcroForm fields, or to append a generated "Completed details" page when the form
has no fillable fields.

**Calendar.** OAuth with PKCE-style state cookie, refresh tokens stored per
user, automatic refresh, and a live probe (`/api/calendar/status?verify=1`)
that actually calls Google so "Connected" is never stale. Events are all-day
with the exclusive end date handled correctly and reminders attached.

**Weather.** Open-Meteo geocoding + forecast (no key). "Use my location" reverse
geocodes with BigDataCloud.

**Rate limits.** Gemini calls go through `lib/gemini.ts`, which falls back
through `gemini-3.1-flash-lite` and `gemini-2.5-flash` on a 429.

---

## Tech stack

- [Next.js 16](https://nextjs.org) App Router, React 19, TypeScript, Tailwind CSS v4
- [Supabase](https://supabase.com): Postgres + pgvector, Auth (email and Google),
  Storage, row-level security
- [Google Gemini](https://ai.google.dev): document understanding, form matching,
  chat, vision, embeddings
- Google Calendar API
- [pdf-lib](https://pdf-lib.js.org): AcroForm filling and PDF generation
- [Open-Meteo](https://open-meteo.com) and BigDataCloud: weather and reverse
  geocoding, no keys
- Web Speech API and `getUserMedia` for voice and camera (secure origins only:
  localhost or https)

---

## Running it yourself

### Prerequisites

- Node.js 20 or newer
- A Supabase project
- A Gemini API key
- (Optional) A Google Cloud OAuth client for Google sign-in and Calendar

### Environment variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Then:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### Supabase setup

1. Enable the **vector** extension (Database → Extensions → `vector`).
2. Create a **private** Storage bucket named `Documents`.
3. Create the tables below (all with a `user_id uuid references auth.users` and
   RLS policies of the form `auth.uid() = user_id`):

   | Table | Purpose |
   | --- | --- |
   | `profiles` | `id` (= auth user id), `full_name`, `email`, `city`, `agent_permission` |
   | `documents` | `file_name`, `file_path`, `doc_type`, `doc_category`, `status`, `uploaded_at` |
   | `document_fields` | `document_id`, `field_name`, `field_value`, `page_number`, `confidence` |
   | `document_chunks` | `document_id`, `content`, `embedding vector(768)` |
   | `deadlines` | `document_id`, `title`, `expiry_date`, `status` |
   | `entities` / `entity_documents` | named entities and their document links |
   | `tasks` | `title`, `done`, `document_id` |
   | `chat_messages` | `role`, `content`, `sources` |
   | `activity_log` | `action`, `details`, `created_at` |
   | `custom_categories` | `name`, `icon` |
   | `google_tokens` | `access_token`, `refresh_token`, `expiry_date`, `scope` |

4. Create the vector search function used by Ask NEXUS:

   ```sql
   create or replace function match_documents(
     query_embedding vector(768), match_user_id uuid, match_count int
   ) returns table (id uuid, document_id uuid, content text, similarity float)
   language sql stable as $$
     select c.id, c.document_id, c.content,
            1 - (c.embedding <=> query_embedding) as similarity
     from document_chunks c
     where c.user_id = match_user_id
     order by c.embedding <=> query_embedding
     limit match_count;
   $$;
   ```

5. Authentication → URL Configuration: set the Site URL and add
   `http://localhost:3000/auth/callback` (and the production equivalent) to
   Redirect URLs.

### Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → create an **OAuth
   client ID** (Web application).
2. Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → Google: paste the client ID and
   secret, enable.

Email/password keeps working without this.

### Google Calendar

Optional; everything else works without it.

1. Enable the **Google Calendar API** in the same Google Cloud project.
2. On the OAuth consent screen add the scopes
   `calendar.events`, `calendar.freebusy`, `openid`, `userinfo.email`.
3. Add `GOOGLE_REDIRECT_URI` (local and production) to the OAuth client's
   Authorized redirect URIs.
4. In the app: Settings → Google Calendar → **Connect**, then **Send test
   event** to confirm it lands.

### Gemini

Get a key at <https://aistudio.google.com>. The free tier is enough to try the
app; heavy use (many uploads, long chats) needs billing enabled or you will see
429s and slower fallback models.

---

## Deploying

The app deploys to [Vercel](https://vercel.com) with no changes:

1. Import the GitHub repo.
2. Add every environment variable above, with `GOOGLE_REDIRECT_URI` set to
   `https://<your-domain>/api/auth/google/callback`.
3. Add the same URL to the Google OAuth client, and
   `https://<your-domain>/auth/callback` to Supabase Redirect URLs.
4. Deploy. Pushes to `master` redeploy automatically.

---

## Project structure

```
app/
  page.tsx               Landing page
  layout.tsx             Fonts, viewport, global styles
  globals.css            Design tokens and utilities (.card, .glass, .rail, .skeleton, ...)
  login/  signup/        Auth pages (shared shell in components/auth-shell.tsx)
  auth/callback/         Supabase OAuth code exchange; creates profile rows for Google users
  dashboard/
    layout.tsx           Desktop rail, phone top/bottom bars, Ask pill, scroll frame
    page.tsx             Home
    documents/           Vault; documents/[id]/ is the detail page
    ask/                 Ask NEXUS chat
    reminders/           Dates and renewal plan
    scan/                Scan & Fill
    tasks/  activity/    To-dos and the audit trail
    profile/  settings/  Account
  api/                   Route handlers (see API reference)

components/
  auth-shell.tsx         Login/signup frame with Google button
  brand.tsx              NexusMark / NexusWordmark
  icons.tsx              SVG icon set
  category-icon.tsx      Duotone icons per document category
  doc-icon.tsx           File-type icons
  week-view.tsx          Seven-day strip (weather + calendar + deadlines) with inline city form
  page-asides.tsx        TwoCol layout and the right-hand panels on each page

lib/
  gemini.ts              Prompts for extraction, form analysis, plans; embeddings; 429 fallbacks
  upload.ts              Upload with progress; NDJSON stage reader
  doc-status.ts          Derived document health
  conflicts.ts           Cross-document mismatch detection
  checklist.ts           "What documents do I need" handling
  sensitive.ts           Masking Aadhaar / PAN / account numbers
  pdf-form.ts            AcroForm filling and the generated answers page
  delete-document.ts     Cascading delete
  google-calendar.ts     OAuth, token refresh, event creation, free/busy, upcoming events
  weather.ts             Open-Meteo + reverse geocoding
  permissions.ts         Agent permission levels and server-side checks
  categories.ts          Built-in and custom categories
  dates.ts               daysLeft / daysLabel helpers
  supabase-browser.ts    supabase-server.ts  require-user.ts   Supabase clients and auth guard
```

---

## API reference

All routes require a signed-in Supabase session (cookie). Responses are JSON
unless noted.

| Route | Method | What it does |
| --- | --- | --- |
| `/api/process-document` | POST | Extracts fields, dates, entities; embeds chunks. Streams NDJSON stage events (`scanning`, `extracting`, `analysing`, `indexing`, `ready`, `failed`). |
| `/api/chat` | POST | Answers a question from your documents; accepts text and an optional image. Returns `{ answer, sources }`. |
| `/api/scan-form` | POST | Reads a blank form and matches each field to a vault value with confidence. |
| `/api/scan-form/fill` | POST | Writes reviewed values into the PDF (`mode: "fields"`) or appends an answers page (`mode: "summary"`). Returns the PDF. |
| `/api/agent/plan` | POST | Builds a renewal plan (needs *Recommend*). |
| `/api/agent/apply` | POST | Creates tasks from an approved plan (needs *Prepare*). |
| `/api/auth/google` | GET | Starts Calendar OAuth (sets a state cookie). |
| `/api/auth/google/callback` | GET | Finishes OAuth, stores tokens. Redirects to Settings with `?calendar=connected` or an error code. |
| `/api/calendar/status` | GET | `{ connected, email }`; add `?verify=1` to probe Google live and get `healthy`. |
| `/api/calendar/upcoming` | GET | Events for the next seven days. |
| `/api/calendar/create-event` | POST | Adds an all-day event with reminders (needs *Execute*). Returns `{ id, htmlLink }`. |
| `/api/calendar/disconnect` | POST | Removes stored tokens. |
| `/api/account/export` | GET | Everything NEXUS holds about you as JSON. |
| `/api/account/delete` | POST | Deletes the account and all data. |

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Upload finishes but the document stays on *reading* or becomes *couldn't read* | Gemini key missing or quota exhausted. Check `GEMINI_API_KEY` and billing, then hit **Retry** on the document. |
| Answers are slow or cut off | 429s are triggering fallback models. Enable billing on the Gemini key. |
| "Connected" in Settings but events do not appear | Click **Reconnect**: the consent screen scopes changed, or the refresh token was revoked. Make sure `GOOGLE_REDIRECT_URI` matches Google Cloud exactly. |
| Google sign-in returns to the login page with an error | The Supabase callback URL is missing from the Google OAuth client, or the provider is disabled in Supabase. |
| Voice or camera button does nothing | The browser only allows them on `https://` or `localhost`. |
| Week view shows no weather | Set a city on Home (or Settings). Open-Meteo could not geocode the name you typed; try the nearest big city. |
| Vector search error in chat | The `vector` extension or the `match_documents` function is missing (see Supabase setup). |
