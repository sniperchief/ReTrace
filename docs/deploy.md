# Deploying ReTrace (Railway + Vercel)

| Part | Where | Folder |
|---|---|---|
| Website (Next.js) | **Vercel** (Hobby, free) | `web/` |
| AI service (Whisper + Gemma 3 1B) | **Railway** | `inference/` |
| Database | **MongoDB Atlas** (free cluster) | — |

Keep all three in **Europe**: Atlas Frankfurt or Ireland, Railway "EU West", Vercel `fra1` (set in `web/vercel.json`; change it to `dub1` if Atlas is in Ireland).

All production secrets are in **`web/.env.deploy`** (git-ignored, generated locally). Copy values from there; never commit or paste them publicly.

---

## 1. Railway — AI service (do this first; Vercel needs its URL)

1. Railway dashboard → **New Project → Deploy from GitHub repo** → choose `sniperchief/ReTrace`.
2. Open the new service → **Settings**:
   - **Root Directory:** `/inference`. Railway then finds `inference/railway.json` and builds the `Dockerfile`.
   - **Region:** EU West (Amsterdam).
3. **Variables** tab → add:
   | Name | Value |
   |---|---|
   | `INFERENCE_API_KEY` | the `INFERENCE_API_KEY` value from `web/.env.deploy` |

   Railway provides `PORT` automatically; don't set it.
4. **Settings → Networking → Generate Domain.** Copy the URL, e.g. `https://retrace-inference-production.up.railway.app`.
5. **Settings → Serverless (App Sleeping): ON.** The service stops when idle, so you only pay while it runs. The first request after sleep waits about 30–60 s while it starts and loads the models.
6. **Account → Usage → set a spending limit**, so a bill can't surprise you.
7. Wait for the first build. It takes about 10 minutes, because it downloads Whisper (~480 MB) and Gemma (~0.8 GB) into the image. Then open `https://<your-domain>/healthz`. Once Gemma has loaded you should see `{"status":"ok","whisperLoaded":false,"llmReady":true}`.

Expected memory use: ~2–2.5 GB while running.

## 2. Vercel — website

1. Vercel dashboard → **Add New → Project → Import** `sniperchief/ReTrace`.
2. **Root Directory:** `web`. The framework (Next.js) is detected automatically.
3. **Environment Variables** (Production). Copy them from `web/.env.deploy`:
   | Name | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas connection string |
   | `MONGODB_DB_NAME` | `retrace` |
   | `AUTH_SECRET` | from `.env.deploy` (a *new* secret, not the laptop one) |
   | `AUTH_URL` | your Vercel URL, e.g. `https://retrace.vercel.app` (see step 5) |
   | `INFERENCE_MODE` | `remote` |
   | `INFERENCE_BASE_URL` | the Railway domain from step 1.4 |
   | `INFERENCE_API_KEY` | **the same** value you gave Railway |
   | `INFERENCE_TIMEOUT_MS` | `270000` |
   | `MAX_AUDIO_BYTES` | `4000000` |
   | `MAX_AUDIO_SECONDS` | `180` |
4. **Deploy.**
5. If your URL differs from what you put in `AUTH_URL`: Project → Settings → Environment Variables → fix `AUTH_URL` → **Deployments → Redeploy**. Sign-in only works on the URL in `AUTH_URL`; preview deployment URLs won't let you sign in.

The database indexes already exist on Atlas. If you ever use a new database, run `npm run db:indexes` with `MONGODB_URI` pointing at it.

## 3. Check it works

1. Open the Vercel URL → **Create account** → add a customer and generator → **+ Add repair** (manual).
2. Wake the AI first: open the Railway `/healthz` URL and wait for `llmReady: true`.
3. On the generator → **🎙 Voice note** → record a short note → the review page should show the transcript, then a filled form → tick → **Confirm and save repair**.
4. **Repairs** → search for a word from that repair.
5. In a private window, create a second account. It must not see the first account's customers or repairs.
6. On a phone, open the Vercel URL. Recording works there because the site is HTTPS.

## Before a demo

- Open `/healthz` on Railway 5 minutes before, then record one practice note (warms both models).
- Keep notes under about a minute. Speed on Railway hasn't been measured yet; the laptop figures in `docs/inference-benchmark.md` were taken under memory pressure.

## Limits to know

- **Vercel Hobby:** 4.5 MB per upload (the app limits audio to 4 MB) and 300 s per request (the AI timeout is 270 s).
- **Atlas free cluster:** 512 MB, and it pauses after 30 days with no connections (resume it in the Atlas dashboard).
- **Railway:** billed by usage. With sleep on, cost depends on how long it's awake.
- **Not built yet:** password reset and email verification (there's no email provider in this setup).
- **The Docker image has never been built** (no Docker on the development laptop). The llama.cpp binary's library needs were checked against the base image, but Railway's first build is the first real test.
