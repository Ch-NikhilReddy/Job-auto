# HANDOFF.md — CareerPilot AI

**Purpose:** everything another AI (or human) needs to understand, run, verify, and extend this project. Read this before touching code.

- **Owner / profile subject:** Nikhil Reddy Chittepu — B.Tech IT, Anurag University, Hyderabad. Graduation **2027**. CGPA 6.78. Seeking Software Engineer Intern / Full-Stack roles.
- **Repo:** `github.com/Ch-NikhilReddy/Job-auto` — **PUBLIC**
- **Root:** `D:\AIAGENT\AgentForAppling` (monorepo, npm workspaces)
- **Last commit:** `eb03842` (13 commits total)
- **Governing docs:** `AGENTS.md` (token-saving orchestrator rules), `CAREERPILOT_ARCHITECTURE.md` (original plan), `README.md` (capabilities + limits), `DEPLOY.md`, `MONITORING.md`

---

## 1. LIVE DEPLOYMENT

| Service | URL | Runtime | Platform |
|---|---|---|---|
| API | `https://job-auto-106i.onrender.com` | Docker (`./Dockerfile`) | Render |
| Web | `https://job-auto-web.vercel.app` | Vite static | Vercel |
| DB | Supabase Postgres | pooler `:6543` | Supabase |
| Queue | Upstash Redis `saving-albacore-295622` | BullMQ | Upstash |
| Files | Supabase S3 bucket `careerpilot-documents` | ap-south-1 | Supabase |

Health check: `GET /health` → `{"ok":true,"checks":{api/db/queue/storage}}`

---

## 2. WHAT IS BUILT AND WORKING

### 2.1 Job discovery — 8 live public APIs
`apps/api/src/adapters/realAdapters.ts`

| Source | Endpoint | Notes |
|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | 10 **verified** boards |
| Lever | `api.lever.co/v0/postings/{company}?mode=json` | 3 **verified** companies |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{token}` | 6 **verified** boards — **new** |
| Remotive | `remotive.com/api/remote-jobs?limit=100` | remote |
| Himalayas | `himalayas.app/jobs/api?limit=100` | remote |
| RemoteOK | `remoteok.com/api` | remote |
| Arbeitnow | `arbeitnow.com/api/job-board-api` | EU + remote |
| Jobicy | `jobicy.com/api/v2/remote-jobs?count=100` | remote |

All are **public, keyless, documented APIs**. No scraping, no auth, no ToS bypass.

> **MAJOR FIX (2026-10-03).** The previous board lists were **almost entirely dead tokens**. Probing every endpoint directly: **26 of 29 Greenhouse boards returned HTTP 404**, and **11 of 14 Lever companies returned 404**. Company names are *not* ATS board tokens — most of those companies do not use Greenhouse at all. Only `slice`, `groww`, `tcs` (GH) and `meesho`, `cred`, `fi` (Lever) actually resolved. Every token now in the defaults was confirmed HTTP 200 by live probe. **Do not add tokens by guessing company names — probe them first.** Ashby was not integrated before and is now the single biggest source.

**Three quality gates** (applied per-job, in `realAdapters.ts`):
1. `isEntryLevel()` — rejects `senior/sr /staff/principal/manager/director/head of/architect/vp` **plus numbered ladders** (`Engineer 2/3`, `SWE II`, `L3`) and `lead` (word-boundary)
2. `isRelevantLocation()` — India OR genuinely-global Remote. **Region-locked remote is rejected**
3. `isTechRelevant()` — needs a tech title or ≥2 extracted skills; rejects sales/content/BPO/annotation noise

**Measured 2026-10-03 (live, post-fix):** **82 jobs, 45 internships, 21 India-based** across 8 sources.
Per-source: Greenhouse 18 (9 intern, 14 India) · Ashby 34 (22 intern, 7 India) · RemoteOK 16 · Arbeitnow 7 · Himalayas 6 · Lever 1 · Remotive 0 · Jobicy 0.

> **GATE BUGS FIXED — regression-tested, do not revert.** Live probing found two gates passing jobs that are not applyable by a 2027-graduate intern seeker:
> - `isEntryLevel` used the substring `'lead '` (trailing space), so **"Lead, Platform Engineering" passed**, and it had no numbered levels, so **"Software Engineer 3" passed** — both live MongoDB Gurugram roles.
> - `isRelevantLocation` returned true for *anything* containing "remote", so **"Remote - United States", "Remote (US)", "Ontario - Remote"** all passed.
> Both now have dedicated tests in `matching.test.ts`. Removing them will re-admit unapplyable jobs.

Toggle mock data with `USE_MOCK_SOURCES=true` (falls back to 8 seeded jobs in `src/data/jobs.ts`).

### 2.2 Matching engine — transparent scoring
`apps/api/src/utils/jobMatcher.ts` + `apps/api/src/services/jobParser.ts`

Returns a score **plus** a `breakdown` with per-factor `{eligible, reason}` for skills, education, experience, location, role, graduation — plus `matchingSkills[]`, `missingSkills[]`, `hardBlockers[]`, `reasoning[]`, `recommendedAction`.

> **BUG FIXED (found by tests):** experience regex required `years` adjacent to `experience`. "5+ years **of** experience" was missed. Now `/(\d+)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s*(?:experience|exp|background)/i`. The same fix is in `applicationExecutor.ts` — do not revert it.

### 2.3 Document generation
- `services/resumeAgent.ts` — reorders 7 verified projects by JD overlap, extracts ATS keywords **only from `profile.ts` skills**
- `services/coverLetterAgent.ts` — 4-paragraph letter (Opening / Skills+Projects / Why this role / Closing)
- `services/docxGenerator.ts` — real `.docx` (docx@7.8.2) + real `.pdf` (pdf-lib), uploaded to S3
- `services/storage.ts` — S3-first with local `generated/` fallback

### 2.4 Truthfulness gates (the core safety feature)
- `services/qaAgent.ts` — **blocks** fabricated skills, projects, degrees before any file is generated (`422 QA_BLOCKED`). Warns on visa/salary questions. Flags `2CaRvN` as unwanted.
- `services/applicationAnswerAgent.ts` — answers only from verified profile. **UNKNOWN patterns → `needsUser: true`, empty answer, never guessed**: visa/sponsorship, work authorisation, salary expectation, years of experience, relocation, background check, demographics, CAPTCHA/OTP.
- `services/applicationExecutor.ts` — 9 safe criteria before submit (see §4)

### 2.5 Application pipeline
Pipeline: `DISCOVERED → MATCHED → READY → APPROVAL_REQUIRED → APPROVED → APPLYING → APPLIED → ASSESSMENT → INTERVIEW → OFFER / REJECTED / WITHDRAWN`

Key behaviours:
- **Duplicate block** — `POST /applications` returns `409 BLOCK DUPLICATE APPLICATION` on existing `jobId`
- **`submit` is HONEST** — it does **not** apply anywhere. It sets `submissionMethod: 'link_out'`, status `APPLYING`, and tells the user to apply on the company site. (An earlier version falsely wrote `APPLIED`; that was a bug, fixed in `e622207`.)
- **Cross-verification** — `POST /applications/:id/verify` requires evidence (`method`, `confirmationRef`, `note`). Rejects refs containing `example.com`/`localhost`. Sets `verifiedAt` + `verificationMethod` + `verificationNote`.

### 2.6 Zero-touch auto-apply
`services/autoApplier.ts` + `workers/autoApplyWorker.ts`

Playwright/Chromium flow per application:
1. Allowlist check on hostname (`AUTO_APPLY_DOMAINS`) → not allowed ⇒ `BLOCKED_LOGIN`, notify, stop
2. Launch headless Chromium, open `job.sourceUrl`
3. **Pre-interaction block scan** — `CAPTCHA_SIGNALS` (recaptcha, hcaptcha, arkoselabs, perimeterx, "verify you are human", …) and `LOGIN_SIGNALS` ⇒ stop + notify + screenshot
4. Fill 14 verified fields (first/last/full name, email, phone, location, LinkedIn, GitHub, portfolio, university, graduation year, degree, skills, summary) + **upload tailored resume** from S3
5. Click Apply/Submit; re-fill second-step fields; re-scan for CAPTCHA
6. Screenshot to S3 as evidence; set `submissionMethod: 'browser_automated'`, `submittedAt`
7. Detect confirmation text ("thank you", "application received", …) and report it honestly

**Never bypasses CAPTCHA/MFA/OTP** — by design and by spec.

Scheduling: `AUTO_APPLY_SWEEP_CRON` (default `0 */2 * * *`) queues a repeatable BullMQ job `auto-apply-sweep` that sweeps all `APPROVED`/`APPLYING` applications. Also manual: `POST /automation/auto-apply/run`, `POST /applications/:id/auto-apply`.

### 2.7 Auth (added in `eb03842`)
`apps/api/src/config/apiAuth.ts` — `X-API-Key` or `Authorization: Bearer` guard on every route except `/health`, `/health/detailed`, `/`, `/favicon.ico`. No-op when `API_KEY` unset (dev). Frontend routes all calls through `api()` helper in `App.tsx` which injects `VITE_API_KEY`.

### 2.8 Notifications
`services/notification.ts` — dashboard (DB) always + optional **Telegram Bot API** and **Resend email**. Quiet hours 23:00–07:00 with bypass for urgent types. Push types: `auto_apply_blocked`, `auto_apply_failed`, `application_submitted`, `action_required`, `application_verified`, `high_match`, `approval_required`.

### 2.9 Outreach generator
`services/outreach.ts` + `routes/outreach.ts` — 4 templates (`alumni`, `recruiter`, `referral`, `cold_dm`), each grounded only in verified profile facts, each with a send checklist. `GET /outreach/drafts` generates per-job recruiter emails for matches scoring ≥55.

### 2.10 Background workers
Started in-process in `server.ts`: `startDiscoveryWorker()` (6h cron) and `startAutoApplyWorker()` (2h sweep). Both BullMQ on Upstash.

---

## 3. DATABASE

`prisma/schema.prisma` — 4 migrations applied to Supabase.

Models: `User`, `Profile`, `Skill`, `Project`, `Resume`, `JobSource`, `Job`, `SavedJob`, `JobMatch`, `Application`, `ApplicationAnswer`, `ApplicationDocument`, `ApplicationEvent`, `InterviewEvent`, `Notification`, `AuditLog`

Application fields added late: `submissionMethod`, `verifiedAt`, `verificationMethod`, `verificationNote`, `confirmationRef`.

Seed: `prisma/seed.ts` → user id **`user-demo-nikhil`** (hardcoded in routes as the single-user constant). Seeds profile, 23 skills, 7 projects, 5 job sources, master resume.

> **MIGRATION GOTCHA:** `DATABASE_URL` points at the **pgbouncer transaction pooler** (`:6543`). Prisma **migrations cannot use pgbouncer**. Run migrations **locally** with the direct host:
> ```powershell
> $env:DATABASE_URL="postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres"
> npx prisma migrate deploy
> ```
> The Docker `CMD` deliberately does **not** run `migrate deploy` (it hung and prevented the port from binding — fixed in `7b7e0cc`).

---

## 4. ENDPOINTS (all need `X-API-Key` except health)

```
GET  /health, /health/detailed
GET  /profile, POST /profile
GET  /jobs, GET /jobs/:id, GET /jobs/:id/match, POST /jobs/:id/analyze
POST /jobs/match, POST /jobs/manual-import, POST /jobs/:id/save, GET /saved-jobs, GET /dashboard/summary
POST /jobs/:id/prepare                      # tailor docs + QA gate (query: ?applicationId=)
GET  /documents/:fileKey/download
GET  /applications, GET /applications/:id
POST /applications                          # duplicate-blocked
POST /applications/:id/prepare              # answer engine + approval package
PATCH /applications/:id/answers             # user answers UNKNOWN
POST /applications/:id/approve
POST /applications/:id/submit               # link_out only, honest
POST /applications/:id/auto-apply           # zero-touch browser worker
GET  /applications/:id/check                # dry-run 9 safe criteria
POST /applications/:id/verify               # cross-verification w/ evidence
GET  /applications/:id/verify-guide
GET  /applications/:id/timeline
POST /applications/:id/interview
PATCH /applications/:id/status
GET  /applications/:id/documents
POST /automation/run, GET /automation/status, PUT /automation/schedule
POST /automation/auto-apply/run, GET /automation/auto-apply/domains, POST /automation/auto-apply/one/:id
POST /automation/emergency-stop
GET  /notifications, PATCH /notifications/:id/read
GET  /analytics/status
GET  /outreach/templates, /outreach/templates/:kind, /outreach/drafts
```

---

## 5. TESTS — 62 passing

```bash
cd apps/api && npx vitest run
```

| File | Tests | Covers |
|---|---|---|
| `qaAgent.test.ts` | 10 | fabrication blocking, 2CaRvN flag, visa warning |
| `applicationAnswerAgent.test.ts` | 13 | profile-only answers, 9 must-ask patterns |
| `applicationExecutor.test.ts` | 11 | all 9 submit blockers incl. fees/CAPTCHA/duplicates |
| `autoApplier.test.ts` | 7 | allowlist, subdomain spoofing, field mapping |
| `matching.test.ts` | 13 | relevance gates + transparent scoring **+ 4 new gate regression tests** |
| `documents.test.ts` | 5 | project reordering, no fabricated years |
| `outreach.test.ts` | 7 | truthfulness, placeholders, no 2CaRvN |

Total: **66 passing**.

**Regression warning:** several tests exist specifically to catch the experience-regex, `sr ` filter, `lead `/numbered-level and region-locked-remote gate bugs described in §2.1–2.2. Don't delete them.

---

## 6. ENV VARS

```bash
DATABASE_URL=postgresql://postgres.<ref>:<pw>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
REDIS_URL=rediss://default:<token>@<upstash-host>:6379
S3_ENDPOINT=https://<ref>.storage.supabase.co/storage/v1/s3
S3_REGION=ap-south-1
S3_BUCKET=careerpilot-documents
S3_ACCESS_KEY=…   S3_SECRET_KEY=…
API_KEY=<generated; must also be set as VITE_API_KEY on Vercel>
AUTO_APPLY_DOMAINS=boards.greenhouse.io,jobs.lever.co,jobs.ashbyhq.com,apply.workable.com,jobs.smartrecruiters.com,wellfound.com,internshala.com
AUTO_APPLY_DAILY_LIMIT=20   AUTO_APPLY_CONCURRENCY=2   AUTO_APPLY_TIMEOUT_MS=45000
AUTO_APPLY_SWEEP_CRON="0 */2 * * *"
USE_MOCK_SOURCES=false   SOURCE_TIMEOUT_MS=20000
GREENHOUSE_BOARDS=…      LEVER_COMPANIES=…    # optional overrides
TELEGRAM_BOT_TOKEN=…     TELEGRAM_CHAT_ID=…
RESEND_API_KEY=…         NOTIFY_EMAIL=nikhilreddynikhil988@gmail.com
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium   # docker only
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1                       # docker only
PORT=4000
```

`.env` is gitignored. **Never commit real secrets.** A previous audit confirmed no secrets are in tracked files.

---

## 7. DEPLOY GOTCHAS (each one cost a debug cycle — don't repeat)

1. **Render runtime must be Docker.** Node runtime has no Chromium. Dockerfile path is `./Dockerfile` at repo **root** (an `apps/api/Dockerfile` copy also exists). Base image must be `node:20-bookworm-slim`, **not alpine** (Chromium needs glibc).
2. **Do not gate startup on `prisma migrate deploy`** — pgbouncer is incompatible and it prevented the port from binding ("No open ports detected").
3. **Server must bind `PORT` first**, then `APP_PORT`, then 4000. Render injects `PORT`.
4. **Vercel:** Root Directory must be `apps/web`, `outputDirectory: dist` (not `apps/web/dist`). `apps/web/vercel.json` handles this.
5. **Vercel needs `VITE_API_KEY`** matching Render's `API_KEY`, or every request returns 401 and no button works.
6. `apps/api/package.json` build script is `tsc -p tsconfig.json`; run typechecks with `npx tsc -p apps/api/tsconfig.json --noEmit` from repo root.

---

## 8. KNOWN LIMITS — STATE THESE, DON'T HIDE THEM

1. **No mainstream platform has a submit API.** Auto-apply only works on clean ATS forms (Greenhouse, Lever, Ashby, Workable, SmartRecruiters). LinkedIn / Naukri / Internshala need logins ⇒ `BLOCKED_LOGIN`, user applies by hand.
2. **CAPTCHA is never bypassed** ⇒ `BLOCKED_CAPTCHA` + screenshot + Telegram alert.
3. **Indian tech internships are thin in public APIs.** Real volume sits on login-walled portals. Use `+ Manual job` in the dashboard.
4. **`verifiedAt` is never auto-set.** Only user-supplied evidence marks it verified — the agent cannot confirm a company received anything.
5. **Automation may violate site ToS.** Keep `AUTO_APPLY_DOMAINS` narrow; it is opt-in per host.
6. **AI layer is template-based.** `ai/provider.ts` has the provider abstraction but returns `mockProvider` unless a real key is wired — by design, to eliminate hallucination risk.
7. **Metrics/skills panels in the dashboard are still hardcoded sample values** (`initialData` in `App.tsx`). Only jobs/applications/notifications are live.

---

## 9. RESOLVED — resumes removed from git tracking

**Was:** the public repo tracked 9 resume documents with phone/email PII, and several old variants **mention 2CaRvN** — which the owner explicitly asked to keep out of his applications. Verified by unzipping each `.docx` and grepping `word/document.xml`:

| Contains `2CaRvN` (5) | Clean (4) |
|---|---|
| `Nikhil_Resume_BackendFullStack.docx` | `Nikhil_Cover_Letter_General.docx` |
| `Nikhil_Resume_EdTechProductDeveloper.docx` | `Nikhil_Reddy_CH.docx` |
| `Nikhil_Resume_FrontendDeveloper.docx` | `Nikhil_Resume.docx` |
| `Nikhil_Resume_General.docx` | |
| `Nikhil_Resume_SoftwareDeveloper.docx` | |

**Actioned:** `git rm --cached -r Resumes` — files **remain on disk** for local use, tracking removed. `.gitignore` now excludes `Resumes/`, `generated/`, `*.docx`, `*.pdf`. No application code referenced `Resumes/`, so nothing broke.

> **STILL OPEN — history purge.** Removing files from the index does **not** purge prior commits. Anyone with the old commits can still recover all 9 files. A real purge needs `git filter-repo --path Resumes --invert-paths` + force push. **Requires owner approval — destructive and rewrites shared history.**

---

## 10. SUGGESTED NEXT WORK

**Highest value for the owner's actual goal (getting a job):**
1. Resolve §9 (resumes in public repo)
2. Add more Greenhouse/Lever boards for Indian startups hiring interns (`GREENHOUSE_BOARDS` env)
3. Wire a real AI provider for cover-letter tone variety (`ai/provider.ts` stub)
4. Replace the hardcoded dashboard metrics with `/analytics/*` queries
5. Telegram alerts enabled so blocks/failures reach his phone
6. Optional: interview-prep question generator from his verified project list

**Engineering debt:**
- No integration/e2e tests (only unit)
- Single-user hardcoded `user-demo-nikhil` in many routes
- `applications.ts` prepare-endpoint upsert logic uses a `catch` fallback that could double-insert answers
- No rate limiting on public endpoints beyond the API key

---

## 11. VERIFYING THE BUILD

```powershell
cd D:\AIAGENT\AgentForAppling
powershell -ExecutionPolicy Bypass -Command "npx tsc -p apps/api/tsconfig.json --noEmit"
powershell -ExecutionPolicy Bypass -Command "npx tsc -p apps/web/tsconfig.json --noEmit"
powershell -ExecutionPolicy Bypass -Command "npx vitest run"          # in apps/api
powershell -ExecutionPolicy Bypass -Command "npm run build -w @careerpilot/web"
```

Live smoke tests:
```
Invoke-RestMethod https://job-auto-106i.onrender.com/health
Invoke-RestMethod https://job-auto-106i.onrender.com/automation/status -Headers @{'X-API-Key'=$env:API_KEY}
```

---

## 12. GROUND RULES FOR ANY AI WORKING HERE

Read `AGENTS.md` first. Non-negotiable, per the project spec:

- **Never fabricate** skills, experience, degrees, certifications, projects, employment, work authorisation, or sponsorship status. Missing ⇒ `UNKNOWN` + ask the human.
- **Never bypass** CAPTCHA, MFA, OTP, or anti-bot protection.
- **Never** silently switch application mode. Default is `HUMAN_APPROVAL`.
- **Never submit without required approval** when configured that way.
- **Never** apply to the same job twice.
- Every AI-generated statement must trace to `src/data/profile.ts`, the job description, or explicit user input — otherwise flag it.
- Prefer deterministic tools over LLM reasoning (AGENTS.md §2). Run tests after changes (§15).