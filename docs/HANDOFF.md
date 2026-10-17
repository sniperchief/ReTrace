# Handoff — start here in a new chat

Snapshot of where ReTrace stands (2026-10-17) and what's next.

## Current state: built, deployed, working end to end

| | |
|---|---|
| Live website (Vercel) | https://retrace-three.vercel.app |
| AI service (Railway) | https://retrace-production-d25e.up.railway.app (`/healthz` to wake/check) |
| Database | MongoDB Atlas free cluster `retrace` (network access `0.0.0.0/0`) |
| Code | https://github.com/sniperchief/ReTrace (`main`) |

- **Phase 1:** auth, customers, generators, manual repairs, per-technician isolation.
- **Phase 2:** voice and typed notes → Whisper → Gemma suggestion → technician reviews and confirms.
- **Phase 3:** search and filters, generator timeline, deterministic (non-AI) history summary.
- **Model update:** Gemma 3 1B plus a rule-based extractor working together (§13 of the spec).
- The user tested sign-up, customer, generator, manual repair, voice note, search and isolation live: everything worked.

**Read first:**
- `docs/technical-spec.md`: architecture, data model, decisions (§11–13 for the latest).
- `docs/deploy.md`: how the deployment is set up.
- `docs/setup.md`: running locally.

**Secrets** live only in git-ignored files: `web/.env.local`, `web/.env.atlas`, `web/.env.deploy`, `inference/.env`. Never print or commit them.

## UI/UX redesign: built locally, not yet committed (2026-10-17)

Decisions: bottom nav on phones; hero + 3-step "how it works"; setup steps can be skipped (home shows a "Finish setting up" card).
- `/` landing (static; proxy sends signed-in users to `/home`), `/home` action-first home, `/repairs/new` generator picker.
- `/welcome` first-run flow in `src/app/(setup)/`; step derived from records by `server/data/setup.ts` (resumes with nothing stored). Setup forms post a hidden `flow=setup` field so create actions redirect back to `/welcome`.
- Tokens in `src/app/globals.css`; Work Sans; icons in `components/icons.tsx`. Automatic dark mode was dropped (dark stage + light canvas instead).
- 156 tests pass (4 new in `tests/integration/setup.test.ts`); every page checked at 360px with no horizontal overflow.

## Improvements after the redesign (2026-10-17)

- Repair date defaults to today on review; review hides the form until the notes have filled it.
- Call/WhatsApp buttons; "Last time" note when starting a repair; save/delete confirmations (`lib/flash.ts`, one `<Flash />` in the root layout).
- Delete customer (only without generators), generator (with its history, warned), repair — from each Edit page.
- Send repair to customer on WhatsApp + printable receipt (`/repairs/[id]/receipt`).
- Offline voice notes: kept in IndexedDB and uploaded later (`lib/voice-upload.ts`, `components/upload-queue.tsx`).
- Service reminders: optional `serviceIntervalMonths` per generator; "Due for service" on home.
- Nigerian Pidgin (`i18n/messages/pcm.ts`, needs a native-speaker review); language cookie read via `getT()` in `server/i18n.ts`, so every page now renders per request.
- Installable app: `app/manifest.ts`, icons; error pages + `instrumentation.ts` logging.
- Voice-note rate limit: `VOICE_NOTES_PER_HOUR` (default 20), 2 concurrent; run `npm run db:indexes` on production once (TTL index for `voiceUploads`).
- CI: `.github/workflows/ci.yml` runs typecheck, lint, tests, build and Playwright (`npm run e2e`; locally `PW_CHANNEL=msedge`).

## Original redesign brief

Use the design system in **`docs/design/DESIGN.md`**:
- **Colours:** deep violet `#151035`, one teal accent `#1ccac7`, off-white `#fafafa`.
- **Type:** Work Sans, with tight -0.028em tracking.
- **Shapes:** 8px controls, 20px cards, no shadows, hairline borders.
- **Accent rule:** teal only on the primary CTA and one headline word.

What the user asked for:
1. **Landing page** at `/` for signed-out visitors, with **one hero section**.
   - Dark violet stage.
   - Headline with one teal word, built around the tagline "Every repair should leave a history."
   - A one-line explanation.
   - Primary CTA **Create account** and secondary **Sign in**.
   - Signed-in users skip it and go into the app.
2. **Organised first-run flow:** a new account first sees the **customer form**, then the **generator form** (customer preselected), then **record the first repair** (voice first, manual second). Show a step indicator and resume if the user leaves halfway.
3. **Clearer day-to-day flow:** an action-first home (find a generator, start a repair, drafts, recently repaired) and mobile-first navigation.

Open questions to ask the user before building:
- A bottom navigation bar on phones?
- Strictly one hero section, or hero plus a short three-step "how it works"?

**Constraints:**
- Keep all behaviour, security and tests intact (152 tests).
- Redesign the interface and flow only.
- Check every page at 360px width.
- The app uses Next.js 16 with Cache Components. Read `web/node_modules/next/dist/docs/` before relying on Next APIs (see `web/AGENTS.md`).
- Commit and push only when the user asks.
