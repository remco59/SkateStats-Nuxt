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
npm run test:e2e    # Playwright smoke suite -- see below
```

`test/unit/*.test.ts` assert against
`reference/fixtures/calculations/golden_calculations.json` -- real outputs
captured from the old app's own functions, per `REBUILD_PLAN.md` section 5.
A failing golden-fixture test means a real behavior regression, not a
flaky test.

### End-to-end smoke suite

`npm run test:e2e` (Playwright) needs a build first (`npm run build`). It
starts a real production server (`node .output/server/index.mjs`, not
`nuxt dev`) against a throwaway SQLite file (`test/e2e/.tmp-e2e.db`,
git-ignored) seeded with one admin user by `test/e2e/global-setup.ts`, then
walks the golden path end to end in one browser session: login, manually
adding a competition and two races, importing a real PDF result sheet
(`test/e2e/fixtures/sample_sheet.pdf` -- PDF import is used rather than
OSTA/SSR because those need outbound network access this suite shouldn't
depend on), comparing the two races, exporting and re-importing the
account backup, confirming the last remaining admin can't be deleted, and
logging out.

If you're not on the pre-installed Chromium path this repo's sandbox uses,
run `npx playwright install chromium` once first (or point
`playwright.config.ts`'s `launchOptions.executablePath` at your own).

## Account backup & restore (plan section 3/9)

Every account has an **Exporteren**/**Herstellen** pair on `/account`:

- **Export** downloads a JSON file (`server/utils/backup.ts`) whose shape
  deliberately mirrors the *old* app's own backup format (`app/main.py`'s
  `export_user_data`, commit 4dc6959) -- old sqlite column names
  (`competition_date`, `laps_csv`, `dnf` as 0/1, `tag_key`, ...) alongside a
  few new-app-only fields (`status`, `track_type`, `osta_profile_links`)
  that a copy of this app round-trips losslessly and that the old app's
  own reader simply ignores.
- **Restore** (`server/utils/backup.ts`'s `importUserData`) accepts that
  same shape from *either* app. It **replaces** (not merges) the account's
  current competitions, races, targets and blacklist in one transaction --
  restoring means "go back to exactly this backup," not "add these on
  top." A backup taken from the real old app (see
  `reference/fixtures/backup/export_sample.json`, a real shape, not
  hand-built) restores cleanly; this is a pinned acceptance test in
  `test/unit/backup.test.ts`, not just a manual check.

This is a personal, ongoing backup mechanism for the *new* app going
forward -- distinct from the one-time v1-\>v2 database migration below.

## v1 -\> v2 database migration (plan section 9)

`scripts/migration-spike.ts` reads an old-app SQLite file directly (never
writing to it) and writes a **fresh** new-schema database, reporting
per-table row counts before/after and flagging anything that didn't map
cleanly (a `dnf=1` race that still has a `total_time_ms`, an unknown
`tag_key`, a `laps_csv` value that doesn't round-trip to whole
milliseconds):

```bash
npm run migration-spike -- /path/to/old-app/skatestats.db ./data/skatestats.sqlite
```

Run with no arguments, it runs against a synthetic same-shape fixture
(`scripts/lib/synthetic-old-db.ts`) instead -- useful for seeing the report
format, not a substitute for running it against real data before cutting
over. **Rollback is inherent to this design**: since the old file is never
written to and the new file is always fresh, "rolling back" just means
"keep running the old app," or re-running this script -- there is no
in-place migration step to undo.

Passwords migrate as-is rather than via a forced reset: the old app's
`pbkdf2_sha256$...` hashes are recognized at login
(`server/utils/legacy-password.ts`) and lazily upgraded to this app's
scrypt-based hash the first time a migrated account logs in successfully.

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

`.env` needs **both** `NUXT_DB_PATH` and `SKATESTATS_DB` set to the same
path (`.env.example` already does this): `NUXT_DB_PATH` is what the
*running server* reads (Nuxt's runtime-config env override --
`nuxt.config.ts`'s `dbPath` default is baked in at **build** time from
`SKATESTATS_DB`, so setting only that at runtime silently has no effect on
where the server writes its database); `SKATESTATS_DB` is what
`bootstrap-admin.ts`/`migration-spike.ts` read directly when run via
`docker compose exec`, since those run standalone outside the Nuxt
runtime. Forgetting either one doesn't error -- it just means the
container writes its database somewhere other than the mounted `/data`
volume, silently losing data across container recreates.

### Image size

The build stage's `node_modules` carries every devDependency
(`drizzle-kit`, `vue-tsc`, `eslint`, `playwright`, `vitest`, ...) --
~600MB, none of which the running app needs, since Nitro already bundles
the app's actual runtime dependencies into `.output/server/node_modules`
on its own. The Dockerfile's runtime stage instead prunes devDependencies
from the root `node_modules` **in place** (`npm prune --omit=dev`, not a
fresh `npm ci --omit=dev`, which would rebuild `better-sqlite3`'s native
binary from scratch for no reason, or fail to build it at all under
`--ignore-scripts`) before copying it over, cutting root `node_modules`
from ~615MB to ~470MB; `tsx` (itself a devDependency, needed only to run
the standalone `bootstrap-admin.ts`/`migration-spike.ts` scripts) is
preserved across that prune rather than reinstalled.

This sandbox's Docker daemon cannot reach Docker Hub's registry (blocked
by network policy, confirmed via direct `docker pull node:22-alpine`
failures unrelated to the app itself), so an actual `docker build` +
`docker images` size measurement could not be run here. Every step above
*was* verified independently outside Docker on this environment's Node 22
(the exact prune sequence, that `better-sqlite3` and `bootstrap-admin.ts`
keep working afterward, and that `node .output/server/index.mjs` still
starts and serves `/api/health`) -- run `docker compose up -d --build`
yourself to get the final image size and confirm the container starts
cleanly end to end.

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
