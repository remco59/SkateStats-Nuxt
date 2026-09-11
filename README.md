# SkateStats (Nuxt rebuild)

Nuxt rebuild of SkateStats -- see [`REBUILD_PLAN.md`](./REBUILD_PLAN.md) for
the full plan this implements, phase by phase. The original FastAPI/Jinja
app lives in `remco59/SkateStats` and is kept only as a reference (see
`reference/fixtures/`).

## Stack

- Nuxt 4 (Node 22), TypeScript
- Drizzle ORM + better-sqlite3 (SQLite file on a mounted volume)
- `nuxt-auth-utils` for sessions/password hashing
- Tailwind CSS
- Vitest (unit, incl. golden-fixture tests against the old app's real
  behavior) + `nuxt typecheck` + ESLint in CI

## Local development

```bash
cp .env.example .env   # fill in NUXT_SESSION_PASSWORD (32+ chars) etc.
npm install
npm run dev
```

Bootstrap the first admin user (creates it if missing, resets the password
and invalidates existing sessions if it already exists):

```bash
SKATESTATS_DB=./data/skatestats.sqlite \
  npx tsx scripts/bootstrap-admin.ts admin "Your Name" a-strong-password
```

Then log in at `http://localhost:3000/login`.

## Tests

```bash
npm run test        # vitest
npm run lint        # eslint
npm run typecheck   # nuxt typecheck (needs NUXT_SESSION_PASSWORD set)
```

`test/unit/*.test.ts` assert against
`reference/fixtures/calculations/golden_calculations.json` -- real outputs
captured from the old app's own functions, per `REBUILD_PLAN.md` section 5.
A failing golden-fixture test means a real behavior regression, not a
flaky test.

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Then bootstrap the admin user inside the container:

```bash
docker compose exec skatestats npx tsx scripts/bootstrap-admin.ts admin "Your Name" a-strong-password
```

The app listens on `:3000` inside the container, mapped to `:8090` on the
host by `docker-compose.yml`. Data persists in `./data` (mounted at
`/data`).

## Project layout

- `server/db/schema.ts` -- Drizzle schema (see `REBUILD_PLAN.md` section 7
  for the rationale behind each table/field).
- `server/utils/` -- pure, framework-free calculation engine (split/pace
  math, PR/SB sequencing, season boundaries, time parsing) ported from the
  old app and pinned by the golden fixtures.
- `server/api/` -- Nitro server routes.
- `app/pages/` -- Nuxt pages, structured per `REBUILD_PLAN.md` section 11
  (a `Results` hierarchy, a merged Stats+Targets `Progress` section, etc.)
  rather than the old app's flat nav.
- `reference/` -- the rebuild plan and reference fixtures copied from the
  old app's repo (do not treat these as this repo's own test data source
  of truth for anything except pinning old-app behavior).
