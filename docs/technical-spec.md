# ReTrace — Technical Specification (Phase 0)

Status: **Planning only.** Nothing in this document has been implemented. Every security and reliability property listed here is a *requirement for later phases*, not a description of existing behaviour.

Date: 2026-10-16 (revised the same day: switched from paid GPU hosting to a $0 hackathon setup)

**Context:** ReTrace is a hackathon project. The target is a working, demoable app on **free infrastructure**, using small self-hosted models on CPU. Production-scale concerns are noted only where they're cheap to respect.

---

## 1. Environment findings

| Item | Finding | Implication |
|---|---|---|
| Repository | `C:\Users\USER\Desktop\ReTrace` was empty; not a git repo | No existing work to preserve. Initialise git at the start of Phase 1. |
| OS | Windows 10 Pro 19045, WSL2 with Ubuntu | Python model tooling can run under WSL2 if needed. |
| Node / npm | Node 24.18.0, npm 11.16.0 | Meets Next.js 16 requirement (`>=20.9.0`). Use npm. |
| Python | 3.14.7 | Too new for some ML wheels. The inference service pins Python 3.11 in its own Docker image. |
| Docker | Not installed | Not required locally: Hugging Face builds Docker Spaces remotely. |
| CPU / RAM | Intel i5-6200U (2 cores / 4 threads), 7.9 GB RAM | Enough for the web app. Small models can run locally for testing, but slowly and with tight memory. |
| GPU | Intel HD 520 only | Not needed: the chosen models run on CPU. |
| Disk free | ~22 GB | Enough for the small models (~3–5 GB total). |

---

## 2. Technology decisions

| Layer | Choice | Cost | Reason |
|---|---|---|---|
| Web app | **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4** | — | As specified. Server code keeps DB access and secrets off the browser. |
| Validation | **Zod 4** | — | One schema for form input, API input and AI output; emits JSON Schema for constrained model output. |
| Web hosting | **Vercel Hobby** | $0 | Native Next.js hosting. Limits that matter: 4.5 MB request body, 300 s max function duration, 2 GB / 1 vCPU. |
| Database | **MongoDB Atlas free cluster** + official `mongodb` driver | $0 | As specified. 0.5 GB storage is plenty for a demo. |
| Model hosting | **Hugging Face Spaces, Docker SDK, free CPU Basic** | $0 | 2 vCPU, 16 GB RAM, 50 GB non-persistent disk. Enough RAM for both small models at once. Sleeps after ~48 h idle. |
| Speech-to-text | **Whisper `small`** (int8) via **faster-whisper**; `base` as faster fallback | $0 | MIT licensed. Runs on CPU with ~1.5 GB RAM. `small` is noticeably more accurate than `base` on accented English; `base` is ~2× faster. |
| Language model | **Gemma 4 E2B** (4-bit) via **Ollama** | $0 | Apache 2.0. Smallest Gemma 4 (~2.9 GB weights at Q4). Short-context extraction is a light task. Ollama supports JSON-Schema-constrained output. |

### Why no GPU

The workload is small: one voice note (under ~2 minutes) and turning a few hundred words into a short JSON record. Small models do this on CPU in tens of seconds. That's acceptable for a demo because notes are saved first and the UI shows progress. A GPU would only buy speed we don't need, at a cost we can't justify.

### Model notes

- **Gemma 4 E2B memory (official, weights only):** 2.9 GB at Q4_0, 5.7 GB at 8-bit. Ollama's `gemma4:e2b` download is listed at 4.6–7.5 GB because it also includes the vision/audio components.
- **Upgrade path:** if E2B extraction quality is poor in testing, try `gemma4:e4b` (Q4 ~4.5 GB weights). It still fits in 16 GB RAM, but expect roughly twice the latency.
- **Whisper on CPU:** faster-whisper's official benchmark shows `small` int8 transcribing 13 minutes of audio in 1 min 42 s on an 8-thread desktop CPU. On a 2-vCPU Space, expect roughly real-time or a little faster. *Unmeasured — to be tested.*
- **Language:** force `language="en"`. Auto-detection is known to misfire on Nigerian English and output the wrong script.

### Licensing
- Gemma 4: Apache 2.0. (Older Gemma 1–3n use different terms; don't swap them in.)
- Whisper weights and code, faster-whisper, Ollama: MIT.

### Fallbacks if the Space is unavailable
1. Run the same inference service locally on the laptop (via WSL or Python 3.11) and point the web app at it. Slow but works.
2. *(Removed: an early mock mode was dropped so fake AI output can never appear in the app.)*
3. Manual entry always works without AI.

---

## 3. Architecture

```
 Technician's phone (browser)
   │  HTTPS — session cookie only, no secrets
   ▼
 ┌────────────────────────────────────────────┐
 │ web  (Vercel Hobby)                        │
 │ Next.js: UI, auth, Route Handlers,         │
 │ Server Actions, Zod validation, DB access  │
 └───────┬───────────────────────────┬────────┘
         │ mongodb+srv (TLS)         │ HTTPS + Bearer INFERENCE_API_KEY
         ▼                           ▼
 ┌──────────────────┐   ┌───────────────────────────────────────┐
 │ MongoDB Atlas    │   │ inference (Hugging Face Docker Space, │
 │ free cluster     │   │ free CPU Basic)                       │
 │ technicians,     │   │  FastAPI (Python 3.11)                │
 │ customers,       │   │   POST /v1/transcribe → faster-whisper│
 │ generators,      │   │   POST /v1/extract    → Ollama/Gemma  │
 │ repairs          │   │   GET  /healthz                       │
 └──────────────────┘   └───────────────────────────────────────┘
```

### Component responsibilities

**web** (Vercel)
- Renders UI; authenticates technicians; scopes every read/write to the signed-in `technicianId`.
- Accepts audio uploads and typed notes; enforces limits.
- Saves the technician's original notes/transcript **before** calling the LLM.
- Owns the extraction prompt and Zod schema; sends the JSON Schema to the inference service; validates the returned JSON again with Zod.
- Holds all secrets.

**inference** (HF Space)
- Stateless. No database access, no user identity, nothing persisted.
- Rejects any request without the correct `Authorization: Bearer <INFERENCE_API_KEY>`.
- `/v1/transcribe`: audio in → `{ text, durationSec, model }` out. Audio held in memory/temp and deleted after the request.
- `/v1/extract`: `{ text, schema, promptVersion }` in → Ollama with `format: <schema>`, `temperature: 0` → raw JSON + model id out.
- Models are pulled at **image build time** so a restart doesn't re-download them. If the free tier's build limits make that impractical, they're pulled at startup instead (slower wake-up).
- Processes one request at a time; extra requests queue.

### Request flow: voice note → draft repair record
1. Browser records with `MediaRecorder` (WebM/Opus on Android Chrome; MP4/AAC on iOS Safari). One minute of Opus is roughly 0.2–0.5 MB.
2. Upload to a Route Handler → auth check → validate type/size (≤ 4 MB, under Vercel's 4.5 MB limit) and duration (≤ 3 min).
3. Create a `repairs` document with `status: "draft"` and `source.transcriptStatus: "pending"`.
4. Forward audio to `/v1/transcribe`. Store the transcript on success; mark `failed` on error or timeout.
5. Call `/v1/extract` with the transcript. Validate with Zod. Store under `aiSuggestion`.
6. Technician reviews the pre-filled form, edits, and **confirms** → reviewed values become the record and `status: "confirmed"`.

Typed notes follow the same path from step 3, skipping transcription.

**Timing budget:** Vercel allows 300 s per function call, which is enough for transcription plus extraction on CPU. To be safe and to give better feedback, transcription and extraction are **two separate calls** from the browser, each with its own progress state.

**Failures and a sleeping Space:** the draft with the original notes already exists, so nothing is lost. The UI says it couldn't process automatically and offers retry or manual entry. Opening the record screen sends a `/healthz` "wake-up" ping so the Space is warm by the time recording ends.

---

## 4. Data model (MongoDB)

All tenant-owned documents carry `technicianId`; every query **must** include it. IDs are `ObjectId`, timestamps UTC `Date`, money stored as **integer kobo** with a currency code.

*Implemented in Phase 1, with two refinements:*
- *`technicianId` is stored as the auth library's user id string, and technician accounts live in Better Auth's `technicians` collection.*
- *`repairs.source.kind` also allows `"manual"`. Manual entries are saved as `confirmed`, because the technician typed them.*
- *Customers also have `searchKeys`.*

### `technicians`
```ts
{ _id, name: string, phone?: string, email?: string, businessName?: string, createdAt, updatedAt }
// credentials/sessions live in the auth library's own collections
```

### `customers`
```ts
{
  _id, technicianId,
  name: string,
  phone?: string,          // normalised E.164 (+234…)
  location?: string,       // free text: "Ikeja, by Allen roundabout"
  notes?: string,
  createdAt, updatedAt
}
```

### `generators`
```ts
{
  _id, technicianId, customerId,
  label: string,           // what the technician calls it: "Mama Bisi's big Sumec"
  brand?: string, model?: string, serialNumber?: string,
  capacityKva?: number,
  fuelType?: "petrol" | "diesel" | "gas" | "other" | null,
  location?: string,
  searchKeys: string[],    // lowercase label/brand/model/serial/customer name/phone, for lookup
  lastRepairAt?: Date,
  createdAt, updatedAt
}
```

### `repairs`
```ts
{
  _id, technicianId, generatorId, customerId,
  status: "draft" | "confirmed",
  repairDate: Date | null,
  reportedSymptoms: string | null,
  diagnosis: string | null,
  workPerformed: string | null,
  partsReplaced: { name: string; quantity: number | null; costKobo: number | null }[],
  totalCost: { amountKobo: number; currency: "NGN" } | null,
  technicianNotes: string | null,

  source: {                     // original input — never overwritten by AI
    kind: "voice" | "text",
    typedText?: string,
    transcript?: string,
    transcriptStatus?: "pending" | "done" | "failed",
    transcriptionModel?: string,
    audioDurationSec?: number
  },
  aiSuggestion?: {              // unverified model output
    fields: { /* same shape as the editable fields, all nullable */ },
    model: string, promptVersion: string, createdAt: Date, error?: string
  },
  confirmedAt?: Date,
  createdAt, updatedAt
}
```

Rules:
- Every repair field is nullable. `null` means "not stated" and shows as blank, never as a guess.
- Top-level fields count as verified only when `status === "confirmed"`.
- Parts are embedded in the repair so a generator's history is one query.

Relationships: `technician 1─* customer 1─* generator 1─* repair`.

### Indexes
| Collection | Index | Purpose |
|---|---|---|
| customers | `{ technicianId: 1, name: 1 }` | List/search customers |
| customers | `{ technicianId: 1, phone: 1 }` (partial) | Find customer by phone |
| generators | `{ technicianId: 1, searchKeys: 1 }` | Prefix lookup |
| generators | `{ technicianId: 1, customerId: 1 }` | A customer's generators |
| generators | `{ technicianId: 1, lastRepairAt: -1 }` | Recently serviced list |
| repairs | `{ technicianId: 1, generatorId: 1, repairDate: -1 }` | **Repair history for a generator** |
| repairs | `{ technicianId: 1, status: 1, updatedAt: -1 }` | Unfinished drafts |

---

## 5. Security and reliability requirements (planned, not implemented)

Kept to what matters for a demo that handles real-looking customer data.

**Auth and isolation**
- Established auth library (Better Auth or Auth.js) with httpOnly, Secure cookies; library-managed password hashing.
- `technicianId` always comes from the server session, never from client input. Another technician's document returns 404.
- One data-access layer is the only code that touches collections, so scoping can't be skipped.

**Secrets**
- Server-only; never `NEXT_PUBLIC_`. Secret-reading modules import `server-only`.
- Vercel environment variables and Hugging Face Space secrets. `.env.local` git-ignored; commit `.env.example` only.
- Inference requires a shared bearer key (`INFERENCE_API_KEY`), known only to Vercel and the Space.

**Audio and uploads**
- Allowed types: webm, ogg, mp4/m4a, mpeg, wav; check magic bytes. ≤ 4 MB, ≤ 3 min.
- Audio is not stored. It's held for the request and then discarded; the transcript is kept.
- Don't log audio, transcripts or customer details.

**Input and AI output validation**
- Zod on every Server Action and Route Handler; length limits on text fields.
- Gemma output is constrained by JSON Schema **and** re-validated with Zod; invalid output counts as a failed extraction.
- Prompt: extract only what's stated, use `null` otherwise, never guess costs, parts or dates.
- Numbers and dates the AI extracts must appear in the source text, or they're flagged "check this".
- `temperature: 0`; model id and prompt version stored with each suggestion.

**Preservation and confirmation**
- Original notes/transcript saved before any AI call; AI never overwrites `source`.
- AI output stays in `aiSuggestion` until the technician presses Confirm.
- Browsing history and manual entry work even when inference is down.

**Atlas network access:** Vercel has no fixed outgoing IP, so the Atlas IP access list will be `0.0.0.0/0`. Access relies on a strong database password and TLS. That's acceptable for a hackathon; it isn't for production.

---

## 6. Cost

| Item | Cost |
|---|---|
| Vercel Hobby | $0 |
| MongoDB Atlas free cluster | $0 |
| Hugging Face Space, CPU Basic | $0 |
| Model licences | $0 |
| **Total** | **$0** |

---

## 7. Project structure

```
ReTrace/
├─ docs/
│  └─ technical-spec.md
├─ web/                      # Next.js 16 app (Phase 1+)
│  ├─ src/app/
│  ├─ src/components/
│  ├─ src/server/            # server-only: db, data-access layer, auth, inference client
│  ├─ src/lib/schemas/       # shared Zod schemas
│  ├─ .env.example
│  └─ package.json
├─ inference/                # FastAPI service deployed as a HF Docker Space (later phase)
│  ├─ app/
│  ├─ Dockerfile
│  └─ requirements.txt
├─ .gitignore
└─ README.md
```

---

## 8. Environment variables (placeholders, not created yet)

| Name | Where | Purpose |
|---|---|---|
| `MONGODB_URI` | web | Atlas connection string (secret) |
| `MONGODB_DB_NAME` | web | Database name |
| `AUTH_SECRET` | web | Session signing secret |
| `AUTH_URL` | web | App URL for auth callbacks |
| `INFERENCE_BASE_URL` | web | HF Space URL (or `http://localhost:7860` locally) |
| `INFERENCE_API_KEY` | web, inference | Shared bearer key (secret) |
| `INFERENCE_MODE` | web | `off` \| `remote` |
| `INFERENCE_TIMEOUT_MS` | web | Per-call timeout |
| `WHISPER_MODEL` | inference | `small` (default) or `base` |
| `GEMMA_MODEL` | inference | `gemma4:e2b` (default) |

---

## 9. Risks, assumptions, open decisions

### Risks
1. **Transcription accuracy (high).** Published results show off-the-shelf Whisper, especially the small models, struggles with Nigerian English. Pidgin and code-switching are largely unmeasured. *Mitigations:* force English, give Whisper a vocabulary hint (brand names, AVR, carburettor, plug, coil…), always show an editable transcript, and prepare demo recordings in advance.
2. **Speed on free CPU (medium).** Each step is estimated at tens of seconds; unmeasured. *Mitigations:* separate steps with progress, a wake-up ping, and `base` Whisper if `small` is too slow.
3. **Space sleeping or rebuilding (medium).** Free Spaces sleep after ~48 h idle, and waking means reloading the models. Wake it before any demo.
4. **Extraction quality from E2B (medium).** The smallest Gemma may miss or mislabel fields. Mitigated by nullable fields, grounding checks, mandatory review, and the E4B upgrade path.
5. **Shared free resources (low–medium).** The Space handles one request at a time. Fine for a demo; not for many simultaneous users.
6. **AI inventing details (medium).** Mitigated but not eliminated. The technician confirms everything.

### Assumptions
- Android Chrome as the main demo device; notes mostly in English or Nigerian English, under ~2 minutes.
- Accounts on Vercel, MongoDB Atlas and Hugging Face are available (all free).

### Open decisions
1. **Sign-in method.** *Recommendation:* email or phone + password. Text-message codes need a paid SMS provider.
2. **Pidgin/code-switching** — in scope for the demo, or English only?
3. **Gemma audio vs Whisper** — keep Whisper as specified; optionally compare later.

---

## 10. Phase 1 recommended scope and acceptance criteria

**Scope:** project skeleton, authentication and tenant-isolated data foundation. No AI.

1. `git init`, `.gitignore`, `README.md`, `web/` scaffolded with Next.js 16 + TypeScript (strict) + Tailwind 4 + ESLint.
2. Mobile-first app shell with ReTrace branding.
3. Server-only MongoDB client and `.env.example`.
4. Authentication: sign-up, sign-in, sign-out, protected routes.
5. Data-access layer enforcing `technicianId` scoping, plus an index-creation script.
6. Zod schemas for technician, customer, generator, repair.

**Acceptance criteria**
- `npm run build`, `npm run lint` and type-check pass.
- Signed-out users are redirected to sign-in; protected Route Handlers return 401.
- An automated test shows technician A can't read or change technician B's data.
- No secret appears in the client bundle.
- Usable at 360 px width with no horizontal scroll.
- Index script runs repeatedly without errors against a dev Atlas database.
- No voice, transcription, Gemma or repair CRUD code yet.

---

## 11. Phase 2 implementation notes (voice notes and AI-assisted entry)

**Changes from the plan above:**
- **LLM runtime: llama.cpp `llama-server` instead of Ollama.** It is CPU-only and about 20 MB, and it serves the same GGUF models with JSON-Schema-constrained output through an OpenAI-compatible API. The Windows Ollama bundle was too heavy to test on the development laptop. The inference service calls `/v1/chat/completions`, so Ollama still works if pointed at it.
- **Model file:** Google's official `gemma-4-E2B-it-qat-q4_0` GGUF (3.35 GB, text only; the vision projector isn't needed).
- **`/v1/transcribe` takes a raw audio body**, not multipart. Multipart parsers spool large uploads to temporary files, and audio must never touch disk.
- **The inference endpoint is generic:** `/v1/extract` takes `{instructions, text, schema}`. The prompt and schema live in the web app (`src/lib/extraction.ts`) next to the validation that checks the output.
- **Auth between web and inference:** a shared bearer key, since Hugging Face has no service-to-service IAM.

**Draft lifecycle (`repairs` collection):**

```
voice upload ─▶ draft {source.kind:"voice", transcriptStatus: pending→done|failed}
typed notes  ─▶ draft {source.kind:"text", typedText}
                  │ review page opens → runExtraction (atomic claim, one run at a time)
                  ▼
            aiSuggestion {status: running→done|failed, fields, flags, model, promptVersion}
                  │ technician edits the form + ticks "I've checked" → confirmDraftAction
                  ▼
            status:"confirmed", reviewed fields copied to the record (the suggestion is kept for audit)
```

- Drafts never appear in repair history, recent repairs, or `lastRepairAt`. They can't be changed through the normal edit path.
- `source.transcript` / `source.typedText` are never overwritten. A correction goes to `source.editedText`, and extraction re-runs from that.
- Audio is held in memory for one request, then dropped. It is never stored.
- If an upload or extraction is interrupted, the draft is reported as failed after 6 minutes.

**Output validation (`processModelOutput`):**
- Anything other than a JSON object is a failed extraction.
- Wrongly typed fields are dropped and flagged *invalid*.
- Costs and quantities must appear among the numbers in the notes (handling "15,000", "15k", "2 thousand", "two"). Otherwise they're dropped and flagged *not_in_notes*.
- Dates are accepted only if the notes say today or yesterday, or give the day and month. Future dates are rejected.
- Parts and text fields must share at least half their meaningful words with the notes.
- Placeholders such as "N/A" or "unknown" become empty.

## 12. Phase 3 implementation notes (finding past repairs)

**Search (`/repairs`, `src/server/data/search.ts`):** ordinary MongoDB queries. No text index, vector database or AI.
- **What's searched:**
  - Confirmed repairs only; drafts are never searched.
  - Problem, diagnosis, work done, part names and other notes.
  - The original transcript, typed notes and corrected notes of AI-assisted records.
  - The generator's details and its customer's name and phone, through the generator's existing `searchKeys`.
- **Matching:**
  - Case-insensitive *word-prefix* matching: "plug" finds "Spark plug" and "plugs", but not "unplugged".
  - Every word must match somewhere, up to 6 words.
  - Input is escaped, so regex characters are literal.
- **Ranking:**
  - Done in the app: a match in problem, diagnosis, work done or parts (weight 3) beats generator/customer or other notes (2), which beats the original transcript (1).
  - Results get a bonus for containing the exact phrase.
  - Ties sort newest first, then undated.
  - Each result shows where it matched.
- **Filters:**
  - Part name (word-prefix).
  - Date range, inclusive. Undated records are excluded when a date filter is set, and the page says so.
  - One generator (`?generator=`).
  - Malformed dates or a reversed range show an error; nothing is guessed.
- **Isolation:**
  - Every query starts with `technicianId`.
  - Generator matches are looked up within the same technician.
  - A `generator` filter for an id that isn't the technician's returns no results and shows no label.
- **Scale:**
  - Matching scans the technician's confirmed records using the `technician_status_date` index. Up to 300 matches are ranked, and the page says when results were cut off.
  - Fine for one technician's history (hundreds to low thousands of records). It isn't designed for very large collections.

**Limitations, by design for this phase:**
- **Not semantic:** "won't start" won't find "hard to start" unless the words overlap. Synonyms and misspellings aren't handled, and Pidgin is handled only if the same words are used.
- Amounts aren't searchable as text.
- Atlas Search, a MongoDB `$text` index or embeddings could be added later if real use shows the need.

**Generator timeline:** confirmed repairs, newest first, with undated records grouped last.
- Each entry shows date, problem, diagnosis, work done, parts (quantity and cost when recorded) and total.
- Fields that weren't recorded say "Not recorded".
- Each entry links to its record.

**Previous-repair summary (`src/lib/history-summary.ts`):** deterministic code, not Gemma.
- **It restates only what was recorded in confirmed repairs:**
  - Date span.
  - The most recent record's problem, diagnosis and work.
  - Parts recorded as replaced, grouped only when the name is identical ignoring case and spacing, with total quantity only when every record stated one.
  - Total charges, counting only records that had a total.
  - How many records are missing each field.
- **Sources:** every line links to the record(s) it came from.
- **Labelling:** it is visually separate from the timeline and says it is compiled automatically and isn't a diagnosis.
- **No inference:** it never relates a past fault to today's, never says a part "failed again", and never groups symptoms.
- **Why not AI:** generating it in code means it can't hallucinate, needs no model time on the free CPU host, and is fully testable. No AI summary was added, so there is no AI-summary accuracy to claim.

## Sources consulted
- Gemma 4 model overview — https://ai.google.dev/gemma/docs/core
- Gemma 4 Apache 2.0 announcement — https://opensource.googleblog.com/2026/03/gemma-4-expanding-the-gemmaverse-with-apache-20.html
- OpenAI Whisper README — https://github.com/openai/whisper
- faster-whisper README — https://github.com/SYSTRAN/faster-whisper
- Ollama Gemma 4 library — https://ollama.com/library/gemma4
- Ollama structured outputs — https://docs.ollama.com/capabilities/structured-outputs
- Hugging Face Spaces overview — https://huggingface.co/docs/hub/spaces-overview
- Vercel Functions limits — https://vercel.com/docs/functions/limitations
- MongoDB Atlas free cluster limits — https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- Whisper on Nigerian English: https://arxiv.org/pdf/2407.02631 ; https://www.isca-archive.org/interspeech_2025/weilinghoff25_interspeech.pdf
- npm registry (2026-10-16): next 16.4.2, tailwindcss 4.3.3, mongodb 7.7.0, zod 4.6.7
