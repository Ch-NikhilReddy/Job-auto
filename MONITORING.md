# Monitoring + QA (Phase 11)

## Health
- `GET /health` — api + db + queue + storage checks
- `GET /health/detailed` — counts: jobs, applications, notifications
- `GET /automation/status` — lastRun, nextRunAt, queue jobCounts

## Logs (structured)
- Fastify logger (pino) — all routes log at level 30
- Worker logs: `[DiscoveryWorker] job ... completed` / `failed`
- Notify logs: `[Notify][dashboard] ...`

## QA Gates (never bypass)
- `services/qaAgent.ts` — blocks invented skills/projects before DOCX generation (422)
- `services/applicationAnswerAgent.ts` — UNKNOWN flagged, never guessed
- `services/applicationExecutor.ts` — 9 safe checks before APPLIED

## Dashboard observability
- Web polls `/notifications` every 30s, shows unread badge
- `GET /analytics/status` — distribution by status

## Alerts
- Add UptimeRobot → `https://your-api.onrender.com/health` (check every 5m)
- Optional: Sentry DSN → `SENTRY_DSN` env, `npm install @sentry/node`

## Test
```
Invoke-RestMethod http://localhost:4000/health | ConvertTo-Json -Depth 3
Invoke-RestMethod http://localhost:4000/health/detailed
Invoke-RestMethod http://localhost:4000/automation/status
Invoke-RestMethod http://localhost:4000/analytics/status
```
