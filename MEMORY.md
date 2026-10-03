# AI Memory — CareerPilot AI

Compact state for a fresh session. Full detail in `HANDOFF.md`.

## Identity

- **Subject:** Nikhil Reddy Chittepu — B.Tech IT, Anurag University, Hyderabad, grad **2027**, CGPA 6.78
- **Goal:** Software Engineer Intern / Full-Stack role. Immediate 6-month internship, full-time mid-2027
- **Stack:** React, Next.js, Node, Express, Spring Boot, MongoDB, MySQL, Java, JS/TS
- **Projects (verified, from his resume):** Smart-Hostel (React+Spring Boot+MySQL), Gas-Agency (MERN), Civic Portal (MLRIT Hackathon **Winner**), Student-Teacher (MERN), Ecoyaan Checkout (Next.js), ACF firewall (mini project), Custom OS bootloader
- **Hard rule from owner:** `2CaRvN` (friend's startup) must **NOT** appear in applications — keep it out
- **Owner style:** short prompts, wants autonomous execution, wants to be notified on errors, not asked constant questions

## Project

- **CareerPilot AI** — autonomous job-application agent
- Repo `Ch-NikhilReddy/Job-auto` (**public**), root `D:\AIAGENT\AgentForAppling`, monorepo npm workspaces
- API `job-auto-106i.onrender.com` (Docker) · Web `job-auto-web.vercel.app` (Vite)
- Supabase Postgres (pooler :6543) + Upstash Redis + Supabase S3
- Fastify 5 · Prisma 5 · BullMQ · Playwright/Chromium · React+Vite+Tailwind
- **13 commits**, last `eb03842`

## Status: functionally complete

Discovery (7 live APIs, 35 filtered jobs) · transparent matching · DOCX+PDF tailoring · QA fabrication gate · answer engine (UNKNOWN never guessed) · approval workflow · **zero-touch auto-apply** (Playwright, allowlist, CAPTCHA stop) · cross-verification · 62 passing tests · API-key auth · Telegram/Resend notifications · outreach templates

## Facts that must not be re-derived

1. `DATABASE_URL` = pgbouncer **pooler**; Prisma **migrations must run locally** with the direct host. Docker `CMD` must **not** run `migrate deploy` (caused "No open ports detected").
2. Server must bind `PORT` → `APP_PORT` → 4000.
3. Render must use **Docker**, root `./Dockerfile`, `node:20-bookworm-slim` (not alpine).
4. Vercel: Root `apps/web`, output `dist`, **needs `VITE_API_KEY` = Render `API_KEY`** or all requests 401.
5. `submit` endpoint is **honest** — sets `submissionMethod: 'link_out'`, does not apply anywhere.
6. Auto-apply only works on clean ATS forms. Login-walled sites → `BLOCKED_LOGIN`.
7. Experience-regex bug (`"5+ years of experience"` missed) is FIXED and regression-tested. Don't revert.
8. `ai/provider.ts` intentionally returns `mockProvider` — template-based by design to avoid hallucination.
9. Single-user constant `user-demo-nikhil` is hardcoded across routes.

## Resolved in P0 cleanup (verified)

- `Resumes/` **untracked** (`git rm --cached`) + gitignored, along with `generated/`, `*.docx`, `*.pdf`. Files still on disk. 5 of 9 contained `2CaRvN`. **Git history still holds them — purge needs `git filter-repo` + force push, awaiting owner approval.**
- `render.yaml` had an **`S3_BUCKET` typo**: `careepilot-documents` → fixed to `careerpilot-documents`. Would have broken S3 uploads if the Render dashboard didn't already override it.
- Local `.env` `AUTO_APPLY_DOMAINS` was **12 domains** vs the documented 7. Removed `apply.indeed.com`, `hire.withgoogle.com`, `myworkdayjobs.com` (aggressive anti-bot → guaranteed `BLOCKED_CAPTCHA`) and `jobs.jobvite.com`. Now matches prod exactly. **Production was always correct — the risk was dev-only.**
- Local `API_KEY` now set (was missing → `apiAuth` was a **no-op in dev**). Local value differs from prod; keep Render `API_KEY` == Vercel `VITE_API_KEY`.

## Open item (needs owner decision)

History purge of the 9 resumes (see above). Everything else in P0 is done.

## Verify before claiming done

```powershell
npx tsc -p apps/api/tsconfig.json --noEmit
npx tsc -p apps/web/tsconfig.json --noEmit
cd apps/api; npx vitest run        # expect 62 passed
```

## Never

Fabricate skills/experience/degrees/visa status · bypass CAPTCHA/MFA/anti-bot · switch modes silently · submit without approval · double-apply · write secrets into tracked files.