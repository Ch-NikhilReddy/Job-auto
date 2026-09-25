# CareerPilot AI — Cloud Deployment (laptop OFF)

## 1. What you already have (Phase 1-9)
- Supabase Postgres: `db.uxcvclamtrtzvsuhljcr.supabase.co` (migrated)
- Upstash Redis: `saving-albacore-295622.upstash.io:6379` (queue active, repeat 6h)
- Supabase Storage S3: `careerpilot-documents` bucket (ap-south-1)

## 2. Deploy API (Render / Railway / Fly.io)
**Render:**
1. New Web Service → Connect `AgentForAppling` repo → Root `apps/api`
2. Build: `npm ci && npx prisma generate && npm run build`
3. Start: `node dist/server.js`
4. Env (from your `.env`): `DATABASE_URL`, `REDIS_URL`, `S3_*`, `JWT_SECRET`, `APP_PORT=4000`
5. After deploy, run once: `npx prisma migrate deploy`

**Railway:** same env, `railway up`

**Fly.io:**
```
fly launch --dockerfile apps/api/Dockerfile
fly secrets set DATABASE_URL="postgresql://..." REDIS_URL="rediss://..." S3_ACCESS_KEY=...
fly deploy
```

Worker runs inside same API container (BullMQ `startDiscoveryWorker()` + inline fallback). No separate worker service needed for MVP.

## 3. Deploy Web (Vercel)
1. Vercel → New Project → `apps/web`
2. Build: `npm run build` → Output `dist`
3. Env: `VITE_API_URL=https://your-api.onrender.com`
4. Replace hardcoded `http://localhost:4000` in `App.tsx` with `import.meta.env.VITE_API_URL`

Local docker test:
```
docker compose up --build
# API http://localhost:4000/health, Web http://localhost:5173
```

## 4. Verify laptop-OFF
- Close laptop → Upstash queue `repeat: 0 */6 * * *` still fires → check Supabase `jobs` count grows → `GET https://your-api.onrender.com/automation/status` shows `nextRunAt`
- Notifications still write to Supabase `notifications` table

## 5. Next (Phase 11)
- Add health checks `/health` to Render, UptimeRobot
- Add Sentry/Logtail for worker logs
