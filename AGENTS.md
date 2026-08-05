# AGENTS.md

## Quick start (two terminals)

```bash
# Terminal 1 — API (FastAPI, port 8000)
cd "C:\Users\chris\Documents\Work\brian\flood\view-flood\api"
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2 — Web (Vite, port 5173)
cd "C:\Users\chris\Documents\Work\brian\flood\view-flood"
npm install
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to `:8000` — no CORS setup needed locally. Leave
`VITE_API_BASE_URL` unset in dev; the production value is baked in from the committed `web/.env.production`.

## Verify / CI commands

```bash
# Web
npm run typecheck                      # app + service worker, both strict
npm run lint                           # eslint
npm run test                           # vitest — i18n parity, filter params
npm run check:contrast                 # every documented token pair, both themes
npm run build                          # typecheck + production bundle + service worker

# API
cd api
uv run pytest                          # 41 unit tests, no database needed
uv run ruff check app tests
```

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 7, Tailwind v4, React Router v7, TanStack Query, Leaflet, PWA (injectManifest) |
| Backend | FastAPI, Python 3.12, asyncpg, SQLAlchemy async, uvicorn |
| Database | Supabase (Postgres + PostgREST + Auth + Storage) |
| Deploy | Vercel (web), Render (API), Supabase (DB/storage) |

## Architecture notes

- **One transport boundary**: `web/src/shared/api/client.ts` is the only fetch caller. Browser holds no Supabase key.
- **Reads/writes hit the same Postgres** via asyncpg (not PostgREST) when `SUPABASE_DB_URL` is set.
- **Writes are transactional**: report pipeline resolves-or-creates a camp, bumps counter, inserts report, stores photos, writes audit rows in one tx.
- **Mutations never retry**: OTP, reports, check-ins, pledges are `retry: 0`.
- **`asyncpg` quirk**: `statement_cache_size=0` required (pgbouncer transaction pooler). JSON codec needed for jsonb columns.
- **i18n**: `en.json` / `ml.json` are 1:1 — the parity test fails on drift, and `t()` is typed against English, so a mistyped key is a compile error.

## Env vars

`api/.env` is required. Copy from `api/.env.example` and fill in Supabase credentials. Without privileged keys the API boots but all writes return 503 with a clear message. See `GET /api/v1/health` for `writes_enabled` and `storage_enabled`.

**⚠️ `env.zip` at the repo root is a zipped `api/.env` (real secrets) and is NOT gitignored — never commit it.** Add it to `.gitignore` or delete it.

## Database & data

- **Migrations run over `psql` on the direct connection** (`SUPABASE_DB_URL_DIRECT`, port 5432) — the Supabase CLI and MCP cannot reach this project, so DDL goes through psql. Every statement is idempotent:
  `for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL_DIRECT" -v ON_ERROR_STOP=1 -f "$f"; done`
- **`Camp Details.xlsx` is the only source of camps.** `uv run --project api python scripts/import-camp-details.py` is DESTRUCTIVE — run with `--dry-run` first. Blank free-text cells become the literal `"Unfilled"`; a missing phone stays NULL (it renders as a `tel:` link).
- **No admin self-registration by design.** Create the user in Supabase Auth, then `insert into admin_users (id, email, display_name) values (...)`.

## Trust guardrails

- Never claim official status. Government rows labelled "Government list".
- Two states only: **Verified** and **Unverified — community reported**.
- Reporter phone numbers never public; check-in phones masked.
- No money handled. Donations are pledges.

## Rules

- **Never `git push` unless the user explicitly asks.** Branches may be created/switched locally, but pushing to `origin` requires an explicit request.

## Deployment gotchas

- **CORS_ORIGINS** must list every origin including www/apex variants — a missing one silently blocks all API calls.
- **Render**: `--proxy-headers --forwarded-allow-ips='*'` is required, without it per-IP rate limits collapse into one bucket.
- **Vercel**: root directory must be blank or `web` (not `apps`). Two `vercel.json` files exist on purpose — keep `rewrites`/`headers` in sync.
- **PWA**: caching lives in `src/sw.ts` (injectManifest). Hashed assets `CacheFirst`, navigations and API reads `NetworkFirst` (stale beats absent), but signed photo URLs and all writes are `NetworkOnly`. In production, returning visitors see the previous build until the "new version available" toast — it never auto-reloads.
