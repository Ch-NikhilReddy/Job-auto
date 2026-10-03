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

## Open item (awaiting owner decision)

Public repo tracks **9 resumes with PII**; several old variants mention **2CaRvN** — contradicts his instruction. Options: delete old variants / gitignore `Resumes/` / leave. **Not actioned.** Note: git history still holds them; purge needs `git filter-repo`.

## Verify before claiming done

```powershell
npx tsc -p apps/api/tsconfig.json --noEmit
npx tsc -p apps/web/tsconfig.json --noEmit
cd apps/api; npx vitest run        # expect 62 passed
```

## Never

Fabricate skills/experience/degrees/visa status · bypass CAPTCHA/MFA/anti-bot · switch modes silently · submit without approval · double-apply · write secrets into tracked files.