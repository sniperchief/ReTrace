# ReTrace

**Every repair should leave a history.**

ReTrace is a repair-memory app for independent generator technicians. After a job, the technician speaks or types what they did. ReTrace turns it into a structured repair record, which the technician checks and confirms. The next time that generator breaks down, its full history is one tap away.

**Try it:** https://retrace-three.vercel.app. It works best on a phone; on a laptop, narrow the browser window.

> **Tip for reviewers:** the AI service sleeps when idle to save money. The first voice note after a quiet period can take 30–60 seconds while the service wakes up. Typed notes and manual entry are never affected.

---

## Contents

1. [The problem](#1-the-problem)
2. [Who it's for](#2-who-its-for)
3. [What ReTrace does](#3-what-retrace-does)
4. [A 5-minute demo](#4-a-5-minute-demo)
5. [How the AI is kept honest](#5-how-the-ai-is-kept-honest)
6. [Architecture](#6-architecture)
7. [Technology and cost](#7-technology-and-cost)
8. [Security and privacy](#8-security-and-privacy)
9. [Quality: how it's tested](#9-quality-how-its-tested)
10. [Run it yourself](#10-run-it-yourself)
11. [Project structure](#11-project-structure)
12. [Known limitations](#12-known-limitations)
13. [What's next](#13-whats-next)
14. [Further documentation](#14-further-documentation)

---

## 1. The problem

In Nigeria and much of West Africa, homes and small businesses rely on petrol and diesel generators because grid power is unreliable. Most of these generators are repaired by **independent technicians**: one-person businesses working from a workshop or travelling to customers.

Their repair history lives in their heads, in scattered WhatsApp chats, or nowhere. When a generator comes back weeks later, the technician has to guess:

- *What did I change last time? Was it the AVR or the carburettor?*
- *Is this the same fault coming back, or something new?*
- *What did I charge this customer?*
- *When is this generator due for a service?*

Nobody keeps written records because writing them is slow, and a technician's hands are dirty and busy. Existing job-tracking software is built for companies with office staff, laptops and steady internet. It isn't built for one person with a phone, patchy signal and five jobs a day.

## 2. Who it's for

- **Primary user:** an independent generator technician working alone with an Android phone, often on weak mobile data. They're comfortable with WhatsApp, may prefer Nigerian Pidgin to formal English, and have seconds rather than minutes to record a job.
- **Indirect beneficiaries:** their customers, who get a written record of the work and the price, and service reminders, instead of a verbal promise.

## 3. What ReTrace does

### Record a repair in seconds, by voice
- Tap **Start a repair**, pick the generator, and speak: *"Customer said it won't start. Found weak spark. Replaced spark plug, two thousand five hundred naira."*
- ReTrace transcribes the recording (Whisper) and fills in the form (Gemma 3 1B plus a rule-based extractor that understands common Pidgin phrasing). Typed notes go through the same path.
- The technician **checks every field and confirms** before anything is saved. The AI never writes a record by itself (see [section 5](#5-how-the-ai-is-kept-honest)).
- Manual entry is always available, even when the AI is off or unreachable.

### Find any generator's history instantly
- Each generator has a **timeline** of confirmed repairs: newest first, with undated jobs grouped at the end.
- An **automatic summary** of the history: date range, latest job, parts replaced (and how often), and total charged. It's produced by plain code, not AI, and every statement links to the record it came from.
- **Search** across all repairs by words, part replaced or date range: *"AVR"*, *"won't start"*, *"Mama Bisi"*.
- Starting a new job shows **"Last time (3 Aug 2026): Replaced AVR"** before you record anything.

### Built for the field
- **Works with bad signal:** if there's no connection when a voice note is sent, it's saved on the phone and uploads by itself when the signal returns.
- **Nigerian Pidgin:** the whole interface switches between English and Pidgin with one tap, and the choice is remembered on the device.
- **Phone-first design:** a thumb-reach bottom navigation bar, large touch targets, and every screen checked at 360px width (a small Android phone).
- **Installable:** it can be added to the Android home screen and opens like a native app.

### Helps the technician's business
- **Send to customer:** one tap turns a repair into a WhatsApp message (work done, parts, total in naira), plus a **printable receipt** that can also be saved as a PDF.
- **Service reminders:** set "service every N months" on a generator. Home lists the generators that are overdue or due within two weeks, each with a **Remind** button that opens a ready-written WhatsApp message to the customer.
- **Call or WhatsApp** a customer straight from their page.

### Guided first use
- A new account goes through three steps: **add a customer → add their generator → record the first repair.** Each step can be skipped, and the app resumes at the right step later.
- Every screen leads with its most common action: find a generator, start a repair, finish your drafts.

## 4. A 5-minute demo

Use these values to see every feature. Any email works; no confirmation email is sent.

| Step | What to enter | What you should see |
|---|---|---|
| 1. **Create account** | Name `Chidi Okeke`, any new email, password `Retrace2026!` | The 3-step setup starts |
| 2. Customer | `Mama Bisi`, phone `0803 123 4567` (or your own number, to receive the WhatsApp messages yourself), location `Ikeja, by Allen roundabout` | Step 2, with Mama Bisi already selected |
| 3. Generator | `Big Sumec`, brand `Sumec`, `7.5` kVA, Fuel `Petrol`, **Service every `1 month`** | Step 3: record the first repair |
| 4. First repair | Choose **Fill the form yourself**. Date about **5 weeks ago**. Work done `Replaced spark plug, cleaned carburettor`. Part `Spark plug`, qty 1, cost `2500`. Total `7000` | "Repair saved", plus **Send to customer** and **Receipt** buttons |
| 5. Home | — | Big Sumec under **Due for service** ("Overdue by …"), with a **Remind** button |
| 6. Typed notes | **Start a repair** → Big Sumec → *Type your notes instead*: `Customer said the light is low. Found bad AVR. Replaced AVR, 15000 naira. Total 18000 naira.` | "Last time…" at the top; then the form fills itself, dated today. Tick the check box and confirm |
| 7. History | Open Big Sumec | A timeline of both repairs and a linked summary |
| 8. Search | **Repairs** → search `AVR` | The matching repair, with where the word matched |
| 9. Pidgin | Tap **Pidgin** in the header | "How far, Chidi Okeke". Tap **English** to switch back |
| 10. Offline (optional) | Turn on aeroplane mode, record a voice note, send it, then turn aeroplane mode off | "Saved on this phone", then "uploaded" about a minute later |

## 5. How the AI is kept honest

An app that writes repair records and invoices can't be allowed to make things up. ReTrace treats AI output as a **suggestion**, never as a fact.

1. **The technician's own words are saved first.** The transcript or typed notes are stored before any AI runs, and they're never overwritten. A correction is stored separately, next to the original.
2. **Nothing is saved without a human.** The AI only fills a *draft*. A draft becomes a repair record only when the technician ticks *"I've checked these details against what was actually done"* and presses Confirm. Drafts never appear in the history.
3. **Grounding checks.** Any number, cost, part or date the AI returns must actually appear in the notes, or it's removed. The review page tells the technician what was left empty and why.
4. **Constrained, validated output.** The model is forced to answer in a fixed JSON structure (temperature 0), and the web app validates that answer again. Invalid output counts as a failure, not as data.
5. **Two extractors, side by side.** A small model (Gemma 3 1B) and a deterministic rule-based extractor both read the notes. For each field the AI's grounded answer wins and the rules fill any gaps. If the AI is down, slow or wrong, the rules fill the form alone, and the page says so. On our 7 recorded test notes, the combined output matched the expected fields every time, while the model alone missed parts and totals. See [docs/inference-benchmark.md](docs/inference-benchmark.md).
6. **Transparent sources.** The review page says which method filled which field ("filled by simple rules where the AI left gaps: total charged").
7. **No AI in the summary.** The history summary is ordinary code that only repeats what was confirmed, and each line links to its source record. The page states that it isn't a diagnosis.
8. **Audio is never stored.** Recordings are transcribed in memory and discarded; only the text is kept.

## 6. Architecture

```
 Technician's phone (browser, installable web app)
   │  HTTPS — session cookie only, no secrets on the device
   │  Offline: voice notes wait in the browser's storage (IndexedDB) until online
   ▼
 ┌──────────────────────────────────────────────────┐
 │  web — Next.js 16 on Vercel                      │
 │  UI, accounts, validation, all database access,  │
 │  rule-based extractor, rate limits, all secrets  │
 └────────┬─────────────────────────────┬───────────┘
          │ MongoDB driver (TLS)        │ HTTPS + shared secret key
          ▼                             ▼
 ┌──────────────────┐   ┌────────────────────────────────────────┐
 │ MongoDB Atlas    │   │ inference — FastAPI on Railway (CPU)   │
 │ (free cluster)   │   │  POST /v1/transcribe → Whisper "small" │
 │ customers,       │   │  POST /v1/extract    → Gemma 3 1B      │
 │ generators,      │   │  GET  /healthz       → wake-up ping    │
 │ repairs, auth    │   │ Stateless: no database, nothing stored │
 └──────────────────┘   └────────────────────────────────────────┘
```

**Voice note → repair record:**

1. The phone records audio (WebM/Opus on Android, MP4 on iPhone). With no signal, the recording is kept on the phone and sent later.
2. The server checks the session, the generator's owner, the file type (by its first bytes, not its name), the size and the hourly limit.
3. A **draft** is created *before* transcription, so a failure is recorded, not lost.
4. Whisper transcribes the audio; the audio is then discarded.
5. Gemma and the rule-based extractor fill a suggestion, which goes through the grounding checks.
6. The technician reviews, edits and confirms. Only then does the draft become a repair record.

**Key design decisions**

| Decision | Why |
|---|---|
| Self-hosted small models instead of a paid AI API | No per-request cost, no customer data sent to a third-party AI company, and works on a hackathon budget |
| CPU only, no GPU | The workload is one short note at a time. Tens of seconds is acceptable when the note is saved first and progress is shown |
| Rule-based extractor alongside the model | A 1B-parameter model is cheap but sometimes misses things. The rules are deterministic, testable and understand Pidgin phrasing |
| AI is optional (`INFERENCE_MODE=off`) | The core product (records, history, search) must work with no AI at all |
| Money stored as whole kobo | No rounding errors in naira amounts |
| Every field may be empty | "Not recorded" is shown honestly, never filled with a guess |

## 7. Technology and cost

| Layer | Technology |
|---|---|
| Web app | Next.js 16 (App Router, Server Actions, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS 4 with a custom design system (deep violet, one teal accent, Work Sans): [docs/design/DESIGN.md](docs/design/DESIGN.md) |
| Accounts | Better Auth (email and password, httpOnly session cookies) |
| Database | MongoDB Atlas, official `mongodb` driver |
| Validation | Zod 4: one schema for forms, the API and AI output |
| Speech-to-text | Whisper `small` via faster-whisper (MIT licence) |
| Language model | Gemma 3 1B (Q4_K_M, ~0.8 GB) on llama.cpp (Gemma Terms of Use) |
| AI service | Python 3.11, FastAPI, Docker |
| Testing | Vitest (in-memory MongoDB), Playwright (real browser at phone width), pytest |
| CI | GitHub Actions: typecheck, lint, unit and integration tests, build, browser tests |

**Running cost**

| Item | Cost |
|---|---|
| Vercel Hobby (website) | $0 |
| MongoDB Atlas free cluster | $0 |
| Railway (AI service, sleeps when idle; a spending cap is set) | A few dollars a month at demo traffic |
| Model licences | $0 |

The AI service needs only about 2–2.5 GB of RAM in total, so it can also run on a free Hugging Face Space or on a laptop. [inference/README.md](inference/README.md) has the steps.

## 8. Security and privacy

- **Each technician sees only their own data.** Every database query includes the signed-in technician's id, taken from the server session, never from the browser. One data-access layer is the only code that touches the database, so this can't be skipped. Another technician's record returns "not found". Integration tests check this for every record type.
- **Secrets stay on the server.** The database password, the auth secret and the AI service key exist only in server environment variables, never in the browser bundle or the repository.
- **The AI service is locked and stateless.** It refuses any request without the shared secret key, has no database access, and stores nothing.
- **Uploads are checked** by their actual content (not the file name) and size before any processing; recordings are capped at 3 minutes.
- **Rate limits:** sign-in is rate-limited, and each technician can send at most 20 voice notes an hour (configurable), with 2 transcriptions running at once, so nobody can monopolise the shared AI server.
- **Deleting is deliberate:** every delete needs a second confirmation. A customer can't be deleted while they still have generators. Deleting a generator warns how many records will go with it.
- **Error logs contain no personal data:** server errors are logged as single structured lines, without cookies, request headers or customer details.

## 9. Quality: how it's tested

| Suite | What it covers | Count |
|---|---|---|
| Unit tests (Vitest) | Validation, phone and naira parsing, the rule-based extractor (including Pidgin), the AI/rules merge, the history summary, service due dates, the WhatsApp message builder | in the 172 below |
| Integration tests (Vitest + in-memory MongoDB) | Accounts and sessions, data isolation between technicians, voice-note upload and failures, drafts and confirmation, search, history, deletes, service reminders, rate limiting, the first-run flow | **172 passing** in total |
| Browser tests (Playwright, 360px phone width) | The whole journey: sign-up → setup → notes → review → confirm → share → receipt → offline voice note → delete; switching to Pidgin; that the app is installable; no page scrolls sideways | **3 passing** |
| AI service tests (pytest) | API authentication, input limits, audio decoding | **14** |
| Real AI end-to-end (optional) | A real recording through the deployed Whisper + Gemma service | runs when an AI service URL is configured |

All of these except the optional real-AI test run automatically on every push to GitHub ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## 10. Run it yourself

**You need:** Node.js 20.9 or newer, and a MongoDB database. A free Atlas cluster works; so does the local option in [docs/setup.md](docs/setup.md), which needs no account.

```bash
cd web
npm install
cp .env.example .env.local   # fill in MONGODB_URI and AUTH_SECRET
npm run db:indexes           # creates the database indexes (safe to re-run)
npm run dev                  # http://localhost:3000
```

Without the AI service, everything works except transcribing recordings: typed notes are still turned into a filled form by the rule-based extractor. To add voice notes, run the AI service ([inference/README.md](inference/README.md)) and set `INFERENCE_MODE=remote`, `INFERENCE_BASE_URL` and `INFERENCE_API_KEY`.

**Checks**

```bash
npm run typecheck
npm run lint
npm test                             # unit + integration (downloads MongoDB once)
npm run build && npm run e2e         # browser tests (PW_CHANNEL=msedge to use an installed browser)
```

Deployment (Railway for the AI service, Vercel for the website) is described step by step in [docs/deploy.md](docs/deploy.md).

## 11. Project structure

```
ReTrace/
├── web/                          Next.js app (website + server)
│   ├── src/app/
│   │   ├── page.tsx              Landing page
│   │   ├── (auth)/               Sign in, sign up
│   │   ├── (setup)/welcome/      Guided first run: customer → generator → first repair
│   │   ├── (app)/                Signed-in app: home, customers, generators, repairs,
│   │   │                         voice notes, review, receipt
│   │   ├── api/                  Voice-note upload, AI wake-up ping, auth
│   │   └── manifest.ts, icon-*   Installable-app manifest and icons
│   ├── src/components/           UI, forms, offline upload queue, language switch
│   ├── src/i18n/messages/        en.ts (English), pcm.ts (Nigerian Pidgin)
│   ├── src/lib/                  Rule-based extractor, AI/rules merge, history summary,
│   │                             validation schemas, money, phone, service dates
│   ├── src/server/
│   │   ├── data/                 The only code that touches the database (scoped per technician)
│   │   ├── actions/              Server Actions: validate → authorise → data layer
│   │   ├── extraction.ts         Runs AI + rules and the grounding checks
│   │   └── voice-notes.ts        Upload handling and rate limiting
│   ├── tests/                    Unit and integration tests
│   └── e2e/                      Browser tests
├── inference/                    AI service: FastAPI + Whisper + Gemma (Docker)
├── docs/                         Technical spec, setup, deploy, benchmark, design system
└── .github/workflows/ci.yml      Automated checks
```

## 12. Known limitations

We'd rather be upfront about these:

- **Speed on the free hardware:** on a sleeping, CPU-only service, the first voice note can take 30–60 s to start and extraction can take up to a minute or two. The note is saved first and progress is shown, so nothing is lost, but it isn't instant.
- **Small model:** Gemma 3 1B was chosen to fit cheap hardware and is weaker than larger models. The rule-based extractor and the technician's review make up for it, but complicated notes may need more hand edits.
- **The rules only know common phrasings,** including common Pidgin, and won't understand everything.
- **The Pidgin translation needs a review** by a native speaker before it goes in front of real users.
- **Offline support is partial:** voice notes recorded on an open page are kept and sent later, but opening the app with no connection at all doesn't work yet.
- **No password reset yet:** it needs an email-sending service and is the next planned feature.
- **Search matches words, not meanings:** "AVR" finds "AVR", but "voltage regulator" won't find "AVR".
- **The database allows connections from any address** (Vercel has no fixed address). Access still needs the database password over an encrypted connection. That's fine for a demo, but it should be tightened before a real launch.

## 13. What's next

1. Password reset by email.
2. Full offline mode: open the app, browse history and record notes with no signal at all.
3. Photos of the generator's nameplate and of replaced parts.
4. Yoruba and Hausa, reviewed by native speakers.
5. Optional multi-technician workshops that share customers.
6. Error monitoring (for example Sentry) once the app has real users.

## 14. Further documentation

| Document | What's in it |
|---|---|
| [docs/technical-spec.md](docs/technical-spec.md) | Architecture, data model, decisions and their trade-offs, phase-by-phase notes |
| [docs/inference-benchmark.md](docs/inference-benchmark.md) | Measured transcription accuracy, extraction quality, speed and memory |
| [docs/setup.md](docs/setup.md) | Local setup, database options, environment variables, tests |
| [docs/deploy.md](docs/deploy.md) | Step-by-step deployment to Railway and Vercel |
| [docs/design/DESIGN.md](docs/design/DESIGN.md) | The visual design system |
| [inference/README.md](inference/README.md) | Running and deploying the AI service |
| [web/README.md](web/README.md) | Web app scripts and code layout |
