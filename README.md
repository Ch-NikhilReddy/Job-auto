# CareerPilot AI

A privacy-conscious AI-powered job and internship assistant for student career discovery, matching, resume analysis, and controlled application workflows.

## Quick start

```bash
npm install
npm run dev:api
npm run dev:web
```

## Architecture

- API: Fastify + TypeScript
- Web: React + Vite + Tailwind
- Shared logic: TypeScript library
- Database: PostgreSQL + Prisma
- Queue: Redis + BullMQ
- Storage: S3-compatible object storage

## Current MVP scope

- profile and onboarding seed model
- job matching logic
- API routes for health, profile, jobs, and analytics
- React dashboard shell with sample KPIs

## Notes

- This repository currently contains the MVP foundation and safe architecture scaffolding.
- Real integrations are intentionally behind adapter interfaces and not enabled by default.
"# Job-auto" 
