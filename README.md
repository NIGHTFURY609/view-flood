# Kerala Camp Check

A public, mobile-first platform where every fact about a Kerala flood relief camp carries a visible
verification chain — source, reporter, timestamp — and where communities can confirm status, check in,
and fulfil needs.

Live at **[forwardkerala.com](https://www.forwardkerala.com)**. Product spec:
[`docs/PRD.md`](./docs/PRD.md).

> **Not an official government source.** Instructions from the District Collector and Kerala Police
> always take precedence over anything shown here. See *Trust guardrails* — those rules are load-bearing.

---

## Running it locally

**Prerequisites:** Node 20+, Python 3.12+, [uv](https://docs.astral.sh/uv/), and a `psql` client for
migrations. Verified on Node 22.16 / Python 3.12.10 / uv 0.12.1 on Windows.

### 1. Configure the API

```bash
cp api/.env.example api/.env
```

Fill in from the Supabase dashboard (project `gkyeujohbbduozggnnvk` → Settings → API / Database):

| Variable | Where to get it | Needed for |
|---|---|---|
| `SUPABASE_URL` | already set in the example | everything |
| `SUPABASE_PUBLISHABLE_KEY` | Settings → API | admin sign-in |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API | image upload, signed URLs, admin auth |
| `SUPABASE_DB_URL` | Connection string → **Transaction pooler (6543)** | all reads and writes |
| `SUPABASE_DB_URL_DIRECT` | Connection string → **Session/direct (5432)** | migrations, import scripts |
| `OTP_PEPPER` | any long random string | OTP hashing |

Without the privileged three, the API still boots and serves reads — every write returns a 503 that says
exactly what is missing. `GET /api/v1/health` reports `writes_enabled` and `storage_enabled`.

### 2. Start both processes

```bash
# terminal 1 — API on :8000
cd api
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# terminal 2 — web on :5173
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The Vite dev server proxies `/api` to `127.0.0.1:8000`, so the browser
stays same-origin and needs no CORS locally. Leave `VITE_API_BASE_URL` unset in development — setting it
would bypass the proxy.

### 3. Checks

```bash
npm run typecheck                      # app + service worker, both strict
npm run test                           # vitest — i18n parity, filter params
npm run check:contrast                 # every documented token pair, both themes
npm run build                          # typecheck + production bundle + service worker

cd api
uv run pytest                          # 41 unit tests, no database needed
uv run ruff check app tests
```

### Troubleshooting

**Port 8000 already in use.** A previous uvicorn is still holding it — uvicorn logs "Application startup
complete" and *then* fails to bind, so it looks alive but is not. `netstat -ano | grep :8000` and kill the
PID.

**Stale UI after a change.** The PWA service worker caches the app shell `CacheFirst`. In development it
is disabled, but if you have loaded a production build on the same origin, unregister it under DevTools →
Application → Service Workers.

---

## Layout

```
web/                   React 19 + Vite SPA (React Router v7, TanStack Query, Tailwind v4)
api/                   FastAPI, Python 3.12, uv
supabase/migrations/   10 migrations — 9 inherited, 1 added by this rebuild
scripts/               check-contrast.mjs · import-camp-details.py · migrate-data.py
docs/                  PRD.md · ui-structure.md
render.yaml            API deployment blueprint (rootDir: api)
vercel.json            Web deployment config (outputDirectory: web/dist)
Camp Details.xlsx      The camp dataset (source of truth for camps)
```

This directory is the git root — remote `NIGHTFURY609/view-flood`. Run every command below from here.

The original Lovable prototype was removed once everything was ported. It remains at
`github.com/D-JAK/camp-trust-link` if you need to diff against it.

---

## Deployment

| Piece | Where |
|---|---|
| API | Render — `https://view-flood.onrender.com` |
| Web | Vercel — `https://www.forwardkerala.com` |
| Database + storage | Supabase `gkyeujohbbduozggnnvk` |

### ⚠️ Set `CORS_ORIGINS` to include every domain

**A custom domain and its www/apex variants are separate origins to the browser.** Verified on the live
API: a preflight from `https://www.forwardkerala.com` returns **400 with no
`access-control-allow-origin` header**, so the browser blocks every API call and the site renders empty.

In the Render dashboard set:

```
CORS_ORIGINS=https://forwardkerala.com,https://www.forwardkerala.com,https://view-flood.vercel.app
```

No trailing slashes. (The API strips them defensively, but do not rely on that.) Re-deploy after saving.

### Other Render notes

The start command carries `--proxy-headers --forwarded-allow-ips='*'`. This is **not optional**: without
it every request appears to come from Render's load balancer, collapsing the per-IP OTP rate limit and
the one-check-in-per-network-per-day rule into one shared bucket for all users.

The free plan spins down when idle and can take most of a minute to wake. The client allows a 45-second
deadline, then surfaces a retry alongside the cached last-seen camps rather than hanging.

### After deploying

The service worker means a returning visitor gets the **previous** build from cache on first load, then a
"new version available" toast. It never auto-reloads — that would discard a half-finished report. To
confirm a deploy immediately, use a private window.

---

## Data

### Camps come from `Camp Details.xlsx`

One sheet per district, compiled by on-ground volunteers. This is the only source of camps; all seeded
and synthetic data has been removed.

```bash
uv run --project api python scripts/import-camp-details.py --dry-run   # inspect
uv run --project api python scripts/import-camp-details.py             # DESTRUCTIVE
```

**72 camps** across 7 districts — IDK 23, KTM 20, EKM 10, ALP 9, PTA 7, TVM 2, TSR 1. The Kozhikode and
Wayanad sheets have headers but no rows. 50 camps have a phone number; contact names and numbers are
parsed out of the `INFORMATION SOURCE` column (`"ChandraBose +91 92072 92007"` → name + normalised
number). Every camp links to a `sources` row, so provenance survives.

Blank free-text cells become the literal **"Unfilled"** — 13 camps have no named contact. One deliberate
exception: **a missing phone stays NULL, not "Unfilled"**, because that column renders as a `tel:` link
and a link that dials the word "unfilled" is worse than the honest *"No phone number reported for this
camp."* the UI already shows.

**The sheet has no coordinates**, so distance sorting and the map have nothing to plot until camps are
geocoded or reported with a location through the wizard.

### Consequences of that import

- **The default list filter is "Open now", not "Government list."** Every camp is community-reported
  (`status = active`, `report_count = 1`), so the pre-designated filter matched zero rows. That option was
  removed from the filter UI for the same reason.
- **`lsg_bodies` and `taluks` were rebuilt from the imported camps.** The 1,183 seeded LSG bodies matched
  no camp; the dropdown now holds the 62 localities that actually appear, plus two added taluks
  (Peerumade, Chirayankeezhu) so the cascade resolves.

### Schema

All 10 migrations are applied, plus a **private** `camp-images` bucket (2 MiB cap, image MIME types only).
To replay on a fresh project:

```bash
for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL_DIRECT" -v ON_ERROR_STOP=1 -f "$f"; done
```

The Supabase CLI and MCP cannot reach this project, so DDL goes over `psql` on the **direct** connection.
Every statement is idempotent.

`scripts/migrate-data.py` is retained but historical — it copied the original Lovable dataset before the
spreadsheet became the source.

### Creating an admin

There is no self-registration route by design. Add a user in Supabase Auth, then:

```sql
insert into admin_users (id, email, display_name)
values ('<auth.users id>', '<email>', '<name>');
```

---

## Architecture notes

**One transport boundary.** Nothing outside `web/src/shared/api/client.ts` calls `fetch`, and the
browser holds no Supabase key — even admin login proxies the credential exchange through our own backend.

**Reads and writes hit the same database.** `camps_sql_service.py` serves reads over asyncpg whenever
`SUPABASE_DB_URL` is set, using the `earthdistance` index for distance and trigram indexes for search.
`supabase_rest.py` (PostgREST) survives only as the no-credentials fallback — serving reads from one place
and writes to another would make a freshly submitted report invisible in the list.

**The Pydantic response model is the data-exposure boundary.** The write path connects with a privileged
role and bypasses RLS, so a `GRANT` protects nothing. Routers name columns explicitly, never `SELECT *`.
Reporter phone numbers appear on `/admin/*` responses and nowhere else.

**Writes are transactional.** The report pipeline resolves-or-creates a camp, bumps a counter, inserts the
report, stores photos and writes audit rows in one transaction.

**Mutations never retry.** OTP, reports, check-ins, pledges and admin actions are `retry: 0` —
double-firing a write is worse than an error.

**Uniqueness is enforced by the database.** Check-ins catch Postgres `23505` and read the constraint name
to tell "you already checked in" from "someone on your network did".

**asyncpg needs two non-obvious settings:** `statement_cache_size=0` (the pgbouncer transaction pooler
does not preserve prepared statements) and a json/jsonb codec (without it `auto_flags` arrives as a
*string*, and the admin queue would map over its characters).

---

## Trust guardrails (PRD §7)

Product requirements, not styling choices:

- Never claim official status. Government-sourced rows are labelled "Government list".
- Two states only: **Verified** and **Unverified — community reported**.
- Unverified camps carry a non-dismissible "call before you travel" line.
- Reporter phone numbers are never public; check-in phones render masked (`••••• 3210`).
- The disclaimer strip is not dismissible.
- Rejected and removed camps disappear from every public endpoint.
- No money is handled. A donation is a pledge.

---

## Design system

Tokens live in `web/src/styles/tokens.css`, governed by two rules stated in that file:

1. **Signal colour is reserved.** `verified` / `unverified` / `critical` / `high` / `open` / `closed` are
   the trust vocabulary. Nothing else may use those hues. The interactive colour is blue specifically so
   it cannot be confused with the orange `high`-urgency signal — in the prototype the two were nearly
   identical, so a "use my location" button read as an urgency badge.
2. **Every documented pair is measured.** `npm run check:contrast` parses the `CONTRACT` block and fails
   if any pair drops below target, in either theme. 40 pairs currently pass.

12px type floor, 3px focus rings, 44px targets (hit area moved to the label where the control is
smaller). Lighthouse on `/`: accessibility 100, best practices 100, SEO 100.

---

## Deviations from the prototype

Ported logic is faithful except where the original was wrong. Each is commented at the site:

- **Duplicate detection missed punctuated initialisms.** Punctuation was stripped to spaces *before*
  stopword removal, so "Govt. G.H.S.S. Ranni" became `govt g h s s ranni` and never matched "GHSS Ranni" —
  two records for one camp, the exact failure the feature exists to prevent. Initialisms are now rejoined
  first. Covered by `tests/unit/test_duplicate_detection.py`.
- **OTP hashes are peppered.** `sha256(phone:code)` was brute-forceable offline over a 1M code space.
- **Oversized photos are rejected, not silently dropped.** The prototype's `continue` lost a reporter's
  photo without telling them.
- **Counters increment atomically** rather than read-then-write.
- **The photo flag button does something.** It previously wrote an audit row and nothing else — `hidden`
  was never set anywhere and no query listed flagged images.
- **Check-in family count is a real field.** The prototype hardcoded `familyCount: 1` with no UI.
- **Camps/Requirements is a nav, not Radix Tabs.** As tabs it emitted `aria-controls` pointing at
  tabpanels that never existed; they are route links.

---

## Internationalisation

276 keys, English and Malayalam, 1:1. `src/test/i18n-parity.test.ts` fails the build on drift — the
prototype maintained parity by hand with nothing enforcing it. `t()` is typed against the English
dictionary, so a mistyped key is a compile error. Count-bearing strings use `tp(key, count)` with a
`.one` sibling.
