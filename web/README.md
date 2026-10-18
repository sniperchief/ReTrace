# ReTrace web app

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + MongoDB + Better Auth.

Setup, environment variables and test instructions: [../docs/setup.md](../docs/setup.md).

| Script | What it does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit + integration tests (in-memory MongoDB by default) |
| `npm run db:indexes` | Create MongoDB indexes (idempotent) |

## Layout

```
src/
  app/                 routes: (auth) sign-in/up, (app) customers, generators, repairs
  components/          UI and client forms
  i18n/                UI strings: en.ts (English), pcm.ts (Nigerian Pidgin)
  lib/                 shared, client-safe helpers and Zod schemas
  server/
    auth.ts            Better Auth config (email + password)
    session.ts         requireTechnician(): the only source of the technician id
    data/              data-access layer — every query is scoped by technicianId
    actions/           Server Actions (validate → authorize → data layer)
  proxy.ts             redirects signed-out visitors (UX only; pages re-check)
tests/
  unit/                validation, parsing, search
  integration/         auth, authorization, ownership, repair history
```
