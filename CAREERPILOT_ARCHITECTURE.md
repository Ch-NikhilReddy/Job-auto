# CareerPilot AI — Architecture and delivery plan

## 1. Decisions based on the initial requirements

- Product model: single-user personal AI job-search assistant.
- Deployment target: cloud-first production system with local Docker-based development and easy deployment to managed cloud services.
- Integration policy: safe, read-only, permissioned integrations first; all unsupported sources use mock or adapter stubs that can be enabled later.
- AI model policy: provider-agnostic AI gateway with OpenAI, Groq, and Gemini as options, configured through environment variables.

## 2. Requirement analysis

The application must behave like a privacy-conscious, transparent career assistant that:

- maintains a structured user profile,
- discovers relevant jobs from authorized sources,
- deduplicates and normalizes job listings,
- matches jobs against user qualifications and preferences,
- prepares truthful documents and answers,
- requires explicit approval before submission in most cases,
- tracks all workflow events with audit history,
- keeps the agent running in the background without the user laptop being online.

This is not a static dashboard. It is an operational workflow with a persistent data model, background workers, and a compliance-first application pipeline.

## 3. Platform and API feasibility risks

### 3.1 Job source feasibility

- LinkedIn Jobs: often not publicly accessible via a simple API; many behaviors are permission- and policy-gated. Recommended approach: official feeds, partner access, or read-only integrations where allowed, otherwise adapter disabled.
- Naukri, Foundit, Internshala, CutShort: may have permissioned APIs or site terms that restrict automation. Use adapter interface with capability flags and legal guardrails.
- Indeed: many public job access workflows are restricted; avoid scraping when disallowed.
- Greenhouse, Lever, Ashby: usually easier to integrate through official job boards and APIs; treat as preferred suppliers.
- Company career pages: often inconsistent and may require manual follow-up.

### 3.2 Application automation feasibility

- Most job portals do not allow unrestricted automated application submission.
- Browser-assisted workflow is the safest production pattern for unsupported forms.
- Controlled auto-application only when legal, user-approved, and supported by specific adapters.

### 3.3 AI operational risks

- LLM responses can be hallucinated or structurally invalid.
- Prompt injection in job descriptions and user materials must be neutralized.
- AI output must be validated and stored with version metadata.

### 3.4 Security and privacy risks

- Uploaded resumes and recruiter messages are untrusted content.
- External URLs can trigger SSRF or malicious content.
- Sensitive questions must never be auto-answered.
- Job data and documents must be stored with access control and signed URLs.

## 4. Recommended architecture

### 4.1 High-level system design

- Frontend: React + TypeScript + Tailwind CSS in a responsive dashboard.
- API backend: Node.js + TypeScript + Fastify, exposing REST and optional WebSocket/SSE for live status events.
- Authentication: secure session-based auth with optional MFA and RBAC.
- Database: PostgreSQL + Prisma ORM with relational tables and JSONB metadata.
- Jobs queue: Redis + BullMQ with workers and durable retries.
- Object storage: S3-compatible storage for resumes and generated documents.
- AI gateway: provider-independent layer with model registry, validation, cost tracking, retry, and prompt versioning.
- Background services: scheduled collection workers, matching workers, notification workers, and application pipeline workers.

### 4.2 Runtime model

- API service handles user-facing actions and reads.
- Worker service handles scheduled discovery, matching, notifications, and status updates.
- Scheduler triggers recurring tasks safely with configured intervals.
- Integrations are executed through adapter interfaces and capability checks.
- Queue provides durable processing and dead-letter tracing.
- Object storage keeps resumes private and accessible via signed URLs.

## 5. Recommended technology choices

### Frontend

- React + TypeScript
- Vite or Next.js-style frontend shell if needed for routing and SSR neutrality
- Tailwind CSS
- Dashboard components for profile, resume, jobs, applications, analytics, and settings

Rationale:
- strong ecosystem,
- easy component reuse,
- good fit for responsive user dashboards,
- straightforward deployment on Vercel or Netlify.

### Backend

- Fastify + TypeScript
- Prisma + PostgreSQL
- BullMQ + Redis
- S3-compatible object storage

Rationale:
- Fastify is fast, minimal, and well-suited for typed APIs,
- Prisma handles relational schema and migrations cleanly,
- Redis + BullMQ provides durable worker orchestration,
- Postgres is a good fit for tracking jobs, applications, and audit events.

### AI layer

- provider-agnostic gateway with adapters for OpenAI, Groq, Gemini
- structured outputs enforced through schema validation
- model selection per task, cost tracking, prompt version metadata

Rationale:
- avoids lock-in,
- supports fallback and resilience,
- makes the tool usable under different budgets and quotas.

### Cloud deployment

- Frontend: Vercel/Netlify
- API and workers: persistent VM/container service or managed app platform
- Database: managed PostgreSQL
- Cache/queue: managed Redis
- Storage: private S3 compatible bucket
- Scheduler: cron or managed queue scheduler

## 6. Database schema design

The schema should reflect the full operational lifecycle. Core tables:

### Core user and profile tables

- users
  - id, email, password_hash, mfa_enabled, is_active, created_at, updated_at
- profiles
  - id, user_id, full_name, phone_encrypted, current_city, portfolio_url, github_url, linkedin_url, preferred_locations JSONB, willingness_to_relocate, remote_ok, created_at, updated_at
- education
  - id, profile_id, degree, branch, university, graduation_year, current_year, cgpa, graduation_status, backlogs, notes
- skills
  - id, profile_id, name, category, proficiency, years_experience, source_project_links JSONB
- projects
  - id, profile_id, name, description, url, tech_stack JSONB, created_at
- user_preferences
  - id, user_id, key, value JSONB, updated_at
- automation_rules
  - id, user_id, mode, allowed_sources JSONB, allowed_daily_applications, blocked_companies JSONB, requires_approval, limits JSONB

### Resume and document tables

- resumes
  - id, user_id, title, version_count, status, file_url, file_type, extracted_metadata JSONB, created_at
- resume_versions
  - id, resume_id, version_number, file_key, extracted_data JSONB, ats_summary JSONB, created_by_ai, created_at
- application_documents
  - id, application_id, document_type, resume_version_id, file_key, file_name, uploaded_at

### Job and source tables

- job_sources
  - id, user_id, source_name, adapter_name, is_active, auth_type, status, capabilities JSONB, config JSONB, last_health_check_at
- jobs
  - id, source_id, external_id, source_url, title, company_name, location, work_mode, employment_type, salary_min, salary_max, stipend_min, stipend_max, job_type, description, eligibility JSONB, is_expired, freshness_score, first_seen_at, last_seen_at, retrieved_at
- job_skills
  - id, job_id, skill_name, skill_type, confidence
- saved_jobs
  - id, user_id, job_id, saved_at, status, notes
- job_matches
  - id, user_id, job_id, score, explanation JSONB, matching_skills JSONB, missing_skills JSONB, blockers JSONB, recommended_action, created_at

### Application lifecycle tables

- applications
  - id, user_id, job_id, resume_version_id, status, source, application_url, submitted_at, approved_at, approval_required, duplicate_of_application_id, audit_summary JSONB
- application_answers
  - id, application_id, question_key, question_text, answer_text, answered_by, is_confidential, is_approved, source, created_at
- application_events
  - id, application_id, event_type, event_data JSONB, created_at
- interview_events
  - id, application_id, title, scheduled_at, venue_or_link, notes, created_at
- notifications
  - id, user_id, type, channel, title, message, payload JSONB, status, scheduled_for, sent_at

### Operational and compliance tables

- scheduled_tasks
  - id, user_id, task_type, cron_expression, enabled, config JSONB, next_run_at, last_run_at
- task_runs
  - id, task_id, status, started_at, completed_at, attempts, error_message, logs JSONB
- audit_logs
  - id, user_id, entity_type, entity_id, action, actor, before JSONB, after JSONB, ip_address_hash, created_at
- ai_usage
  - id, user_id, provider, model, task_name, input_tokens, output_tokens, cost_usd, prompt_version, created_at
- integration_credentials
  - id, user_id, source_name, credential_type, encrypted_secret_ref, refresh_token_ref, scopes JSONB, is_revoked, expires_at

Important design notes:
- never store raw passwords,
- use encrypted secret references or OAuth-managed tokens,
- add indexes on user_id, source_url, external_id, status, created_at,
- use JSONB for flexible AI output and metadata,
- set retention policies for logs and AI metadata.

## 7. API contract

### 7.1 Auth and onboarding

- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- POST /api/v1/auth/mfa/enable
- GET /api/v1/me
- PUT /api/v1/profile
- POST /api/v1/profile/onboarding/complete

### 7.2 Profile and preferences

- GET /api/v1/profiles
- PUT /api/v1/profiles/me
- GET /api/v1/skills
- POST /api/v1/skills
- PUT /api/v1/preferences
- GET /api/v1/preferences

### 7.3 Resume management

- POST /api/v1/resumes/upload
- GET /api/v1/resumes
- GET /api/v1/resumes/:id
- POST /api/v1/resumes/:id/analyze
- POST /api/v1/resumes/:id/recommend
- POST /api/v1/resumes/:id/export

### 7.4 Jobs and discovery

- GET /api/v1/jobs
- GET /api/v1/jobs/:id
- POST /api/v1/jobs/manual-import
- POST /api/v1/jobs/:id/save
- POST /api/v1/jobs/:id/match
- GET /api/v1/job-sources
- POST /api/v1/job-sources/:id/health
- POST /api/v1/job-sources/:id/disconnect

### 7.5 Applications

- GET /api/v1/applications
- GET /api/v1/applications/:id
- POST /api/v1/applications/:id/approve
- POST /api/v1/applications/:id/submit
- POST /api/v1/applications/:id/prepare
- POST /api/v1/applications/:id/withdraw
- POST /api/v1/applications/:id/event

### 7.6 Notifications and analytics

- GET /api/v1/notifications
- POST /api/v1/notifications/:id/read
- GET /api/v1/analytics/summary
- GET /api/v1/analytics/source-breakdown
- GET /api/v1/analytics/skill-gaps

### 7.7 Automation and admin

- GET /api/v1/automation/rules
- PUT /api/v1/automation/rules
- POST /api/v1/automation/run
- POST /api/v1/automation/emergency-stop
- GET /api/v1/audit-logs

### 7.8 Internal worker tasks

- POST /api/v1/internal/tasks/discover-jobs
- POST /api/v1/internal/tasks/match-jobs
- POST /api/v1/internal/tasks/notify-user
- POST /api/v1/internal/tasks/process-application

The API should enforce RBAC, validation, and audit logging for all write operations.

## 8. AI agent workflow

### Agent 1 — Career profile analyst
- consolidates profile data,
- detects missing profile information,
- identifies gaps that weaken match quality.

### Agent 2 — Job discovery planner
- converts user profile and preferences into search strategies,
- chooses source priorities,
- decides keywords, locations, and match thresholds.

### Agent 3 — Job source collector
- calls adapters in read-only mode,
- handles retries and rate limits,
- normalizes raw responses into a job model.

### Agent 4 — Job information extractor
- normalizes descriptions,
- extracts skills, eligibility, schedule, salary, and red flags,
- flags uncertain or suspicious content.

### Agent 5 — Job matching analyst
- computes weight-based match score,
- explains eligibility blockers,
- identifies hard and soft mismatches,
- recommends next steps.

### Agent 6 — Resume advisor
- compares resume and job description,
- surfaces missing keywords,
- proposes truthful, reviewable resume edits.

### Agent 7 — Application preparation agent
- prepares answer drafts,
- tracks uncertain questions,
- requires explicit review before data is submitted.

### Agent 8 — Application execution agent
- executes only permitted actions,
- stops on CAPTCHA, OTP, or unsafe UI changes,
- never acts without approval.

### Agent 9 — Application tracker
- updates statuses based on events,
- handles interview and offer events,
- keeps lifecycle history current.

### Agent 10 — Quality assurance agent
- detects duplicates,
- checks for unsupported claims,
- validates job still-open conditions,
- catches workflow anomalies.

### Agent 11 — Notification agent
- sends priority alerts,
- applies quiet hours,
- tracks delivery and failures.

All agents share a validation layer and cannot escalate permissions without an explicit user rule or admin approval.

## 9. Folder structure

```text
careerpilot/
  apps/
    web/
      src/
        app/
        components/
        features/
        lib/
        types/
    api/
      src/
        app/
        modules/
        routes/
        services/
        adapters/
        workers/
        ai/
        utils/
        config/
  packages/
    shared/
      schemas/
      types/
      validators/
  infra/
    docker/
    kubernetes/
    terraform/
  prisma/
    schema.prisma
    migrations/
  docs/
    architecture.md
    api-contract.md
    security.md
    roadmap.md
  tests/
    unit/
    integration/
    e2e/
    fixtures/
  .env.example
  Dockerfile
  docker-compose.yml
  package.json
  README.md
```

## 10. Phased implementation roadmap

### Phase 0 — Discovery and feasibility

- assess job source legality and access constraints,
- produce architecture decision record,
- define MVP and operating assumptions,
- cost and risk review,
- security review,
- confirm non-scraping policy.

### Phase 1 — Functional MVP

- auth and onboarding,
- profile management,
- resume upload and versioning,
- manual job import,
- job storage and matching,
- saved jobs,
- application tracker,
- basic notifications.

### Phase 2 — Cloud automation

- workers and queue,
- scheduled job discovery,
- source adapters,
- deduplication,
- retry logic,
- discovery alerts.

### Phase 3 — AI career assistant

- resume analysis,
- match explanations,
- skill-gap analysis,
- tailored application drafts,
- AI chat assistant for review.

### Phase 4 — Application copilot

- controlled application workflows,
- approval queue,
- browser-assisted forms,
- audit-log review,
- status tracking.

### Phase 5 — Production hardening

- monitoring,
- security review,
- cost control,
- backups,
- DR planning,
- load testing,
- privacy controls,
- production deployment.

## 11. Infrastructure and AI cost estimate

These are planning estimates and depend heavily on usage volume.

### 11.1 Core infrastructure

- Managed PostgreSQL: $20–$80/month for small workloads
- Managed Redis: $15–$60/month
- S3-compatible storage: low monthly cost, depending on resume volume
- Cloud VM/container app: $30–$150/month depending on workload
- Vercel/Netlify: low-cost frontend hosting, often $0–$30/month

### 11.2 AI cost estimate

- Simple profile/resume analysis tasks: low cost per call
- Job matching explanation and drafting: moderate cost per request
- Usage volume matters more than model selection

Planning assumption:
- If handling a few hundred AI tasks per month, the cost can remain modest, but bulk use can quickly grow without guardrails.

Recommended controls:
- per-user quotas,
- budget ceilings,
- prompt caching,
- structured output validation,
- task-specific model selection.

## 12. Security risks and mitigations

### Risk categories

- Secret management: use secure secret vaults and OAuth flows.
- SSRF: validate URLs, allowlists, and block private IPs.
- Prompt injection: treat AI input as untrusted; separate system instructions from user content.
- File upload: scan for extensions, MIME mismatch, and unsafe content.
- Resume privacy: store private resumes only in restricted buckets and signed URLs.
- Application integrity: enforce approval gates, audit logs, and confirmation states.
- Source compliance: disable adapters violating terms or requiring credential misuse.

### Required controls

- RBAC and session management
- MFA option
- CSRF protection for browser sessions
- rate limiting
- audit logs for all state-changing actions
- explicit revocation of integrations
- data export and account deletion
- secure token handling
- encryption-in-transit and encryption-at-rest where supported

## 13. Final recommendation before implementation

The best MVP is a privacy-first, single-user, cloud-ready system with a safe adapter architecture and approval gates, rather than attempting full source automation on day one. The recommended sequence is:

1. Build the profile, resume, jobs, and matching foundation.
2. Add read-only source adapters and deduplication.
3. Add application workflow with approval queue and browser-assisted form support.
4. Enable safe controlled automation only for explicitly allowed sources and workflows.
5. Add AI drafting and notifications after the core system is stable.

This sequence reduces legal, security, and operational risk while preserving a clear path to production.

## 14. Approval gate

This plan is designed to satisfy the project brief while staying compliant, testable, and production-minded. If approved, the next implementation step is to scaffold the repository and begin Phase 0 and Phase 1 work with the user auth, profile, job data model, and job-matching foundation.
