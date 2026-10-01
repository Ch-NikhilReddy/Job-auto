# CareerPilot AI

Autonomous job-application agent for a single user (Nikhil Reddy Chittepu — B.Tech IT 2027, Anurag University).

Live: API `https://job-auto-106i.onrender.com` · Web `https://job-auto-web.vercel.app`

## What it actually does

| Capability | Reality |
|---|---|
| Job discovery | 7 public APIs (Greenhouse, Lever, Remotive, Himalayas, RemoteOK, Arbeitnow, Jobicy). Filtered to entry-level + India/Remote + tech roles. |
| Matching | Transparent score: skills, education, experience, location, role, graduation — with per-factor reasons and blockers. |
| Documents | Tailored `Resume_{Company}_{Role}.docx` + `Cover_{Company}_{Role}.pdf`, ATS keywords, projects reordered to the JD. |
| Truthfulness gate | **Blocks** fabricated skills/projects/degrees. Only emits skills present in `profile.ts`. |
| Answers | Answers from verified profile only. Visa / salary / relocation / demographics → `UNKNOWN`, never guessed. |
| Auto-apply | Playwright fills 14 verified fields, uploads the tailored resume, submits. Zero human step. |
| Blocks | Stops on CAPTCHA / login walls / off-allowlist hosts and notifies. **Never bypasses anti-bot.** |
| Verification | Cross-checks confirmation refs; rejects placeholder domains; records evidence + screenshots. |
| Tracking | Full pipeline `DISCOVERED → … → APPLIED → ASSESSMENT → INTERVIEW → OFFER/REJECTED/WITHDRAWN` with timestamped events. |

## The three modes

- **DISCOVERY_ONLY** — finds jobs, applies to none
- **HUMAN_APPROVAL** *(default)* — prepares everything; you click APPROVE
- **AUTO_APPLY** — sweep every 2h over `APPROVED` applications, auto-fills and submits

## Stack

Fastify 5 · TypeScript · Prisma 5 + PostgreSQL (Supabase) · BullMQ + Redis (Upstash) · Playwright + Chromium · S3 (Supabase Storage) · React + Vite + Tailwind (Vercel) · Docker (Render)

## Setup

```bash
npm install
cp .env.example .env      # then fill DATABASE_URL, REDIS_URL, S3_*, API_KEY
npx prisma migrate deploy # run LOCALLY (pgbouncer pooler can't migrate)
npx tsx prisma/seed.ts    # seeds your profile/skills/projects

# API
cd apps/api && npx tsx src/server.ts     # http://localhost:4000
# Web
cd apps/web && npm run dev               # http://localhost:5173
```

## Env

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | prod | Supabase **transaction pooler** (`:6543?pgbouncer=true`) |
| `REDIS_URL` | prod | Upstash `rediss://default:…@host:6379` |
| `S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET_KEY` | prod | Supabase S3 |
| `API_KEY` | **prod** | Guards all non-health routes. Frontend sends `VITE_API_KEY`. |
| `AUTO_APPLY_DOMAINS` | no | Host allowlist for the browser worker. Empty ⇒ nothing auto-applies. |
| `AUTO_APPLY_SWEEP_CRON` | no | Default `0 */2 * * *` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | no | Push alerts for blocks & submissions |
| `RESEND_API_KEY` / `NOTIFY_EMAIL` | no | Email alerts |
| `USE_MOCK_SOURCES` | no | `true` ⇒ use the 8 seeded demo jobs instead of live APIs |
| `GREENHOUSE_BOARDS` / `LEVER_COMPANIES` | no | Override default company lists |

## Tests

```bash
cd apps/api && npx vitest run     # 62 tests
```
Covers: fabrication blocking, UNKNOWN flagging, submit blockers, allowlist + subdomain-spoofing defence, match scoring, document generation, outreach truthfulness.

## Known limits (be aware)

1. **No major platform has a submit API.** Auto-apply works on clean ATS forms (Greenhouse, Lever, Ashby, Workable, SmartRecruiters). LinkedIn / Naukri / Internshala require logins → `BLOCKED_LOGIN`, apply by hand.
2. **CAPTCHA is never bypassed** → `BLOCKED_CAPTCHA` + screenshot. By design.
3. **Indian tech internships are thin in public APIs.** Most live on login-walled portals. Use `+ Manual job` to add them.
4. **`verifiedAt` is never auto-set.** Only your confirmation evidence marks it verified — the agent cannot confirm a company received anything.
5. **Automation may violate a site's ToS.** Auto-apply is opt-in via `AUTO_APPLY_DOMAINS`; keep it narrow.
6. **Migrations must run from your machine**, not the container (pgbouncer is session-mode incompatible).

## Layout

```
apps/api/src/
  config/     app, db, apiAuth
  data/       profile (single source of truth), seed jobs
  adapters/   realAdapters (7 live APIs), greenhouseAdapter, types
  services/   autoApplier, resumeAgent, coverLetterAgent, qaAgent,
              applicationAnswerAgent, applicationExecutor, docxGenerator,
              storage, notification, outreach, jobParser, jobDiscovery
  workers/    discoveryWorker, autoApplyWorker
  routes/     health profile jobs applications documents automation timeline outreach
  tests/      7 suites, 62 tests
apps/web/src/  App.tsx (dashboard)
prisma/         schema.prisma + migrations
```

## Safety guarantees

Never invents skills, experience, degrees, certifications, work authorisation, or sponsorship status. Never bypasses CAPTCHA, MFA, OTP, or anti-bot. Never submits without approval in `HUMAN_APPROVAL` mode. Blocks duplicate applications. All state changes are audited with timestamped events.
