# ReTrace — Setup Guide

Everything here is free. You need Node.js 20.9 or newer (tested with Node 24) and npm.

## 1. Install

```bash
cd web
npm install
```

## 2. Get a MongoDB database

Pick **one** of these.

### Option A: MongoDB Atlas (free cluster)

1. Sign in at <https://cloud.mongodb.com> and create a project.
2. **Create a cluster** → choose the **Free** tier → pick a region close to your users (e.g. a European region for Nigeria) → Create.
3. **Database Access** → Add New Database User → password authentication. Use a long generated password. Give it the role *Read and write to any database*.
4. **Network Access** → Add IP Address.
   - For local development: *Add current IP address*.
   - For Vercel (no fixed outgoing IP): `0.0.0.0/0`. This is acceptable for the hackathon because access still needs the database password over TLS. Restrict it before any real launch.
5. **Connect** → *Drivers* → copy the `mongodb+srv://…` string and put your user's password into it.

### Option A2: Quickest on this laptop (no account, no Docker)

After `npm test` has run once, the MongoDB binary is already downloaded. Start it as a persistent local database:

```bash
npm run db:local   # keep this terminal open; data is saved in web/.data/db
```

Use `MONGODB_URI=mongodb://127.0.0.1:27017/?directConnection=true`.

### Option B: Local MongoDB (no account needed)

Sign-up uses MongoDB transactions, which need a replica set. Atlas is one already. Locally, start a single-node replica set:

```bash
docker run -d -p 27017:27017 --name retrace-mongo mongo:8 --replSet rs0
docker exec retrace-mongo mongosh --quiet --eval "rs.initiate()"
```

Then use `mongodb://127.0.0.1:27017/?directConnection=true`.

## 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Value |
|---|---|
| `MONGODB_URI` | Connection string from step 2 |
| `MONGODB_DB_NAME` | `retrace` (or any name) |
| `AUTH_SECRET` | Output of `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_URL` | `http://localhost:3000` locally; your deployed URL in production |

`.env.local` is git-ignored. Never commit it.

## 4. Create indexes and run

```bash
npm run db:indexes   # safe to run again at any time
npm run dev          # http://localhost:3000
```

Create an account on the sign-up page. Then add a customer, add their generator, and add repairs from the generator's page.

- **Repairs page:** search confirmed repairs by words (generator, customer, problem, diagnosis, work, parts, notes), part replaced and date range.
- **Generator page:** a summary of the recorded history and a timeline of its repairs.
- **Existing databases:** re-run `npm run db:indexes` after updating. Phase 3 adds one index (`technician_status_date`).

## 5. Checks and tests

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

**About the tests:** the integration tests (auth, authorization, ownership, repair history) need MongoDB.

- **By default** they start a throwaway in-memory MongoDB using `mongodb-memory-server`. It downloads a MongoDB binary once (the Windows download was about 700 MB), then works offline. No Atlas account is needed.
- The AI tests (voice upload, extraction, confirmation) use a **fake inference server** and don't need the models.
- The inference service has its own tests: `cd inference && .venv\Scripts\python -m pytest -q`.
- **To run them against Atlas or another server**, set `TEST_MONGODB_URI`. Each test file creates its own `retrace_test_*` database and drops it afterwards.

  ```bash
  TEST_MONGODB_URI="mongodb+srv://…" npm test
  ```

## 6. AI-assisted entry (optional)

Without this the app is fully usable with manual entry (`INFERENCE_MODE=off`, the default).

| Mode | What you need | What happens |
|---|---|---|
| `off` | nothing | Voice-note buttons are hidden; manual entry only |
| `remote` | the inference service running | Real Whisper transcription and Gemma extraction |

For `remote`:

1. Run the inference service, either locally or on a free Hugging Face Space. See [inference/README.md](../inference/README.md).
2. Generate a shared key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Set it as `INFERENCE_API_KEY` on **both** the service and the web app.
3. In `web/.env.local`:

   ```
   INFERENCE_MODE=remote
   INFERENCE_BASE_URL=http://127.0.0.1:7860      # or https://<user>-<space>.hf.space
   INFERENCE_API_KEY=<the shared key>
   ```

**How it behaves:**
- The technician records or uploads a voice note (up to 3 minutes / 4 MB), or types notes, from a generator's page.
- The audio is sent to the inference service, transcribed, and discarded. **Audio is never stored.** The transcript is stored on a *draft*.
- Gemma suggests the repair fields. The app keeps only details the notes support and leaves the rest empty.
- The technician edits the form, ticks the confirmation box, and saves. Only then does the draft become a repair in the history.
- If transcription or extraction fails, the page says so. The technician can retry, type the notes, or fill the form by hand.

## 7. Deploying (later)

- **Web:** Vercel Hobby (free). Import the repo, set **Root Directory** to `web`, add the environment variables, and deploy. Run `npm run db:indexes` once against the production database.
- **Inference:** a free Hugging Face Docker Space. See [inference/README.md](../inference/README.md).
