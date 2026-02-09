# Project Lazarus - Implementation Guide

> Task-oriented implementation reference for transforming the Next.js SaaS boilerplate into the Lazarus legacy-software transmutation platform. Each section describes WHAT to do, WHY, and provides pseudo code where helpful — no full implementation code.

**Reference Documentation:**
- [Ideation & Vision](project_lazarus.md)
- [System Architecture](ARCHITECTURE.md)
- [UI/UX Design System](UI_UX_GUIDE.md)
- [Brand Guidelines](../brand/brand.md)

---

## Table of Contents

1. [Phase 0: Foundation - Database & Infrastructure](#phase-0)
2. [Phase 1: Core UI Shell & Routing](#phase-1) *(Part 2)*
3. [Phase 2: Upload & Ingestion Flow](#phase-2) *(Part 2)*
4. [Phase 3: Vertical Slice Architecture & Plan View](#phase-3) *(Part 2)*
5. [Phase 4: Glass Brain Dashboard](#phase-4) *(Part 2)*
6. [Phase 5: OpenHands SDK Integration](#phase-5) *(Part 3)*
6b. [Phase 5B: Autonomous Browser Testing & Live View](#phase-5b) *(Part 3)*
7. [Phase 6: Gemini Integration](#phase-6) *(Part 3)*
8. [Phase 7: Testing Strategy](#phase-7) *(Part 3)*
9. [Phase 8: Landing Page & Demo Mode](#phase-8) *(Part 3)*
10. [Pipeline Lifecycle: Checkpoint/Resume System](#pipeline-lifecycle) *(Part 3)*
11. [Phase 9: Dependencies & Enhancements](#phase-9)

---

## Phase Status Summary (0, 1, 2, 3, 4, 5, 6, 9)

| Phase | Status | Verification |
|-------|--------|--------------|
| **Phase 0** | ✅ Complete | [Verification Checklist](#verification-checklist-phase-0--9) (below) |
| **Phase 1** | ✅ Complete | [IMPLEMENTATION_PART2.md - Phase 1 Verification](#phase-1-verification-checklist) |
| **Phase 2** | ✅ Complete | [IMPLEMENTATION_PART2.md - Phase 2 Verification](#phase-2-verification-checklist) |
| **Phase 3** | ✅ Complete | [IMPLEMENTATION_PART2.md - Phase 3 Verification](#phase-3-verification-checklist) |
| **Phase 4** | ✅ Complete | [IMPLEMENTATION_PART2.md - Phase 4 Verification](#phase-4-verification-checklist) |
| **Phase 5** | ✅ Complete | [IMPLEMENTATION_PART3.md - Phase 5 Verification](#phase-5-verification-checklist) |
| **Phase 5B** | ✅ Complete | [IMPLEMENTATION_PART3.md - Phase 5B Verification](#phase-5b-verification-checklist) |
| **Phase 6** | ✅ Complete | [IMPLEMENTATION_PART3.md - Phase 6 Verification](#phase-6-verification-checklist) |
| **Pipeline Lifecycle** | ✅ Complete | [IMPLEMENTATION_PART3.md - Pipeline Lifecycle Verification](#pipeline-lifecycle-verification-checklist) |
| **Phase 9** | ✅ Complete | [Verification Checklist](#verification-checklist-phase-0--9) (below) |

**Phase 1 enhancements implemented:** Logo component in sidebar, Neural Activity Pulse (electric-cyan dot when projects have active builds), Magic UI-style grid background on sidebar.

**Phase 2 enhancements implemented:** Project detail actions (Stop processing, Delete project), DELETE API, structured API logging, Redis unavailability handling, Supabase migration for projects tables, optional GitHub URL/files with "at least one required" validation, Next.js-only framework selection (others "Coming soon"), upgraded project creation wizard UI/UX.

**Phase 3 upgraded to Plan Command Center:** Transformed the basic plan page into a full command center with animated stats bar, search/filter toolbar, collapsible sidebar, topological dependency graph layout, confidence rings, interactive detail sheet with tabs (Overview/Contracts/Dependencies), dependency chain highlighting on hover, MiniMap, view toggle (graph/list), and "Build Next" / "Build This Slice" actions.

**Phase 4 upgraded to Demo-Worthy Glass Brain:** 8 new files + 3 modified on top of the base 6-file Glass Brain. Added: `derive-stats.ts` (pure utility), `header-stats.tsx` (rich header with live counters + agent status pulse), `confidence-sparkline.tsx` (SVG trajectory), `plan-pane-enhanced.tsx` (mini-cards + spotlight + progress bar + view toggle), `work-pane-enhanced.tsx` (slice context headers + test cards + timestamps), `activity-timeline.tsx` (event density strip), `victory-lap.tsx` (celebration overlay at 85%), `ambient-effects.tsx` (breathing glow + pane connection lines). Enhanced `confidence-gauge.tsx` with sparkline/milestones/tooltip, enhanced boot sequence (+600ms, staggered pane reveal), new CSS animations.

**Phase 5B implemented:** Autonomous Browser Testing & Live View. 3 new event types (`browser_action`, `screenshot`, `app_start`), noVNC Docker service for live browser streaming, tabbed Work Pane (Events | Browser | Screenshots), screenshot gallery with lightbox, test credential seeding API, and narrative/pipeline/sound integration for all new event types.

**Phase 5 implemented:** OpenHands SDK integration (Marathon Agent Track). Most of Phase 5.1 (queue system) was already complete from Phase 2. Added: Docker Compose update (containers renamed to `lazarus-*`, OpenHands service with `ghcr.io/all-hands-ai/openhands:latest`, `openhands_workspace` volume), worker concurrency increased to 2, `.env.example` updated with OpenHands/MCP/Demo vars. The slice build route (`/api/projects/[id]/slices/[sliceId]/build`) was already implemented in Phase 2. Phases 5.2-5.4 are architectural specs (self-healing loop runs in OpenHands agent system prompt).

**Pipeline Lifecycle implemented:** Checkpoint/Resume system for the project processing pipeline. 1 SQL migration (5 new columns on projects: `pipeline_step`, `pipeline_checkpoint` JSONB, `error_context` JSONB, `current_slice_id`, `build_job_id`), `'paused'` status added. 3 new library files (`lib/pipeline/`): orchestrator (checkpoint CRUD, error context), slice-builder (event-driven slice orchestration), types (PipelineStep, PipelineCheckpoint, ErrorContext). 3 new API routes: `/resume` (checkpoint resume), `/build` (automated build pipeline), `/slices/[sliceId]/retry` (single slice retry). 10 modified files: worker refactored with checkpoint load/save/skip and pause checks, events route with event→status transitions (test_run→testing, test_result→complete/failed, self_heal→self_healing), smart retry with `?mode=resume|restart|auto`, PATCH stop cancels BullMQ job and uses "paused" status, frontend Resume/Build All/Pause buttons, error context card on project detail, "Retry This Slice" in slice detail sheet.

---

## Execution Order & Dependencies

> **Phase 2/5 Left Brain:** The Left Brain is **Code-Synapse CLI** (not an HTTP server). See [PHASE2_LEFT_BRAIN_INTEGRATION.md](PHASE2_LEFT_BRAIN_INTEGRATION.md) for correct flow: checkout → `code-synapse index` → `code-synapse justify` → start MCP → query MCP tools. **Wait for CLI completion before generating slices.**

```
Phase 0 (MUST BE FIRST - blocks everything)
  ├── Phase 1 (UI Shell)
  ├── Phase 6 (Gemini client)
  └── Phase 9 (Dependencies)
       ├── Phase 2 (Upload/Ingestion)
       │    └── Phase 3 (Slice Architecture)
       │         └── Phase 4 (Glass Brain Dashboard)
       │              └── Phase 5 (OpenHands)
       │                   └── Phase 5B (Browser Testing & Live View)
       │                        └── Pipeline Lifecycle (Checkpoint/Resume)
       ├── Phase 7 (Testing)
       └── Phase 8 (Landing/Demo)
```

---

<a id="phase-0"></a>
## PHASE 0: Foundation - Database & Infrastructure Migration

### 0.0 Implementation Details & Architecture Decisions

**Architecture:**
- **Database:** Supabase (PostgreSQL) is used as the primary database.
- **Authentication:** Better Auth is the identity provider, managing its own tables (`user`, `session`, etc.) within the Postgres database.
- **Data Access:**
  - **Server-Side:** A Service Role client (`lib/db/supabase.ts`) is used for backend operations (admin routes, webhooks, workers). It bypasses RLS, so application-level authorization (e.g., filtering by `user_id`) is mandatory in all queries.
  - **Client-Side:** A Browser client (`lib/db/supabase-browser.ts`) is available for public data or future RLS-enabled features, but primary data fetching is currently routed through Next.js Server Actions/API Routes to leverage the Service Role client securely.

**Completed Tasks:**

- [x] **0.1 Dependencies Update:** Removed MongoDB/Prisma; added Supabase, Gemini, UI libraries.
- [x] **0.2 Files to DELETE:** Removed legacy DB files.
- [x] **0.3 Create Supabase Server Client:** Implemented lazy-init Service Role client.
- [x] **0.4 Create Supabase Browser Client:** Implemented browser client.
- [x] **0.5 Supabase Database Types:** Defined full schema types.
- [x] **0.6 Update DB Index:** Exported new clients and types.
- [x] **0.7 Update Auth Configuration:** Configured Better Auth with PostgreSQL adapter.
- [x] **0.8 Update Environment Variables:** Updated `env.mjs` with Supabase/Gemini vars.
- [x] **0.9 Migrate Activity Feed:** Rewritten for Supabase.
- [x] **0.10 Migrate Audit Logger:** Rewritten for Supabase.
- [x] **0.11 Migrate Usage Tracker:** Rewritten for Supabase.
- [x] **0.12 Update Stripe Webhook:** Updated to upsert subscriptions via Supabase.
- [x] **0.13 Update Admin Dashboard:** Updated to query Supabase.
- [x] **0.14 Update AI Tools:** Updated `query_database` tool for Supabase.
- [x] **0.15 Update Proxy:** Added `/projects` to protected routes.
- [x] **0.16 Supabase SQL Schema:** Generated `docs/supabase-schema.sql`.

### 0.1 Dependencies Update

**File: `package.json`** (MODIFY)

**Task:** Remove MongoDB/Prisma packages and add Supabase, Gemini, React Flow, Framer Motion, and audio/visual enhancement libraries.

**Remove from dependencies:**
- `@prisma/client`, `mongoose`, `mongodb`

**Remove from devDependencies:**
- `prisma`

**Add to dependencies:**
- `@supabase/supabase-js` — Supabase client SDK
- `@supabase/ssr` — Supabase SSR helpers for Next.js
- `@google/genai` — Gemini SDK (structured outputs with Zod)
- `@xyflow/react` — React Flow for interactive dependency graph visualization
- `framer-motion` — Animations for Glass Brain Dashboard, transitions, and theatrical effects
- `use-sound` — Lightweight hook for playing audio cues (typing, success, error, heal sounds)
- `tone` *(optional)* — Web Audio API wrapper for procedural audio effects (synapse hum, confidence tone)
- `@tanstack/react-query` — Data fetching and state management
- `nuqs` — URL state management for dashboard filters
- `magic-ui` (or individual components via CLI) — Theatrical UI elements
- `@temporalio/client` (optional/recommended) — For Marathon Agent orchestration

**Keep unchanged:** `openai`, `bullmq`, `ioredis`, `stripe`, all Radix/shadcn packages, all testing packages.

After editing, run: `pnpm install`

---

### 0.2 Files to DELETE

**Task:** Remove all MongoDB/Prisma related files. These are fully replaced by Supabase.

```
lib/db/prisma.ts        — Prisma client singleton
lib/db/mongoose.ts       — Mongoose connection
lib/db/mongodb.ts        — Legacy MongoDB utils
lib/models/index.ts      — Mongoose models barrel export
lib/models/billing.ts    — Mongoose billing model
prisma/schema.prisma     — Prisma schema definition
```

---

### 0.3 Create Supabase Server Client

**File: `lib/db/supabase.ts`** (NEW)

**Task:** Create a server-side Supabase client using the **lazy-init Proxy pattern** (same pattern used in `lib/billing/stripe.ts`).

**Key decisions:**
- Use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env
- Disable session persistence (server-side, no cookies needed)
- Type the client with the `Database` generic from `./types`
- Export via `Proxy` so it initializes only at runtime (not at build time)

**Pseudo code:**
```
let instance = null

function getSupabase():
  if not instance:
    read SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env
    throw if missing
    instance = createClient<Database>(url, key, { auth: { persistSession: false } })
  return instance

export supabase = new Proxy({}, {
  get(target, prop) -> getSupabase()[prop]
})
```

---

### 0.4 Create Supabase Browser Client

**File: `lib/db/supabase-browser.ts`** (NEW)

**Task:** Create a browser-side Supabase client for use in React components and hooks.

**Key decisions:**
- Use `@supabase/ssr`'s `createBrowserClient` for proper cookie handling
- Read `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public vars)
- Singleton pattern — create once, reuse across components
- This client is used by `SupabaseProvider` and real-time subscription hooks

**Pseudo code:**
```
let browserClient = null

export function getSupabaseBrowserClient():
  if not browserClient:
    read NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
    throw if missing
    browserClient = createBrowserClient<Database>(url, key)
  return browserClient
```

---

### 0.5 Supabase Database Types

**File: `lib/db/types.ts`** (NEW)

**Task:** Define TypeScript types that mirror the Supabase PostgreSQL schema. In production, these can be auto-generated via `npx supabase gen types typescript`.

**Types to define:**

| Type | Values |
|------|--------|
| `ProjectStatus` | `pending`, `processing`, `ready`, `building`, `complete`, `failed`, `paused` |
| `AssetType` | `video`, `document`, `repo`, `screenshot` |
| `SliceStatus` | `pending`, `selected`, `building`, `testing`, `self_healing`, `complete`, `failed` |
| `AgentEventType` | `thought`, `tool_call`, `observation`, `code_write`, `test_run`, `test_result`, `self_heal`, `confidence_update` |
| `SubscriptionStatus` | `active`, `canceled`, `past_due`, `trialing`, `incomplete` |
| `PlanId` | `free`, `pro`, `enterprise` |

**Database interface structure:**

Define a `Database` interface with `public.Tables` containing:

| Table | Row fields | Notes |
|-------|-----------|-------|
| `projects` | id, org_id, user_id, name, description, github_url, target_framework, status, left_brain_status, right_brain_status, confidence_score, metadata (JSONB), pipeline_step, pipeline_checkpoint (JSONB), error_context (JSONB), current_slice_id (FK), build_job_id, created_at, updated_at | Core entity |
| `project_assets` | id, project_id (FK), type, name, storage_path, url, processing_status, metadata, created_at | Uploaded files |
| `vertical_slices` | id, project_id (FK), name, description, priority, status, behavioral_contract (JSONB), code_contract (JSONB), modernization_flags (JSONB), dependencies (UUID[]), test_results (JSONB), confidence_score, retry_count, created_at, updated_at | Feature slices |
| `agent_events` | id, project_id (FK), slice_id (FK nullable), event_type, content, metadata (JSONB), confidence_delta, created_at | Real-time event stream |
| `subscriptions` | id, user_id, org_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_start/end, cancel_at_period_end, plan_id, metadata, created_at, updated_at | Billing |
| `activities` | id, user_id, organization_id, type, action, resource, resource_id, metadata, created_at | Activity feed |
| `audit_logs` | id, user_id, organization_id, action, resource, resource_id, metadata, ip_address, user_agent, created_at | Audit trail |
| `usage` | id, user_id, organization_id, api_key_id, type, resource, quantity, cost, metadata, timestamp, created_at | Usage tracking |

Each table should have `Row`, `Insert` (omitting auto-generated fields like id, created_at), and `Update` (partial of Insert) sub-types.

---

### 0.6 Update DB Index

**File: `lib/db/index.ts`** (MODIFY — replace entire contents)

**Task:** Replace Prisma/Mongoose re-exports with Supabase client and type exports.

**Pseudo code:**
```
export { supabase } from "./supabase"
export { getSupabaseBrowserClient } from "./supabase-browser"
export type { Database, ProjectStatus, AssetType, SliceStatus, ... } from "./types"
```

---

### 0.7 Update Auth Configuration

**File: `lib/auth/auth.ts`** (MODIFY)

**Task:** Migrate Better Auth from Prisma/MongoDB adapter to PostgreSQL (Supabase) adapter.

> 💡 **Tip:** Use the `user-Better_Auth-search` tool to find specific configuration options for the Organization plugin and PostgreSQL adapter.

**Key changes:**
1. Remove `prismaAdapter` import and `getPrisma()` function entirely
2. Configure `database` with `{ provider: "pg", url: process.env.SUPABASE_DB_URL }` — Better Auth supports PostgreSQL natively
3. Change `appName` from `"AppealGen AI"` to `"Project Lazarus"`
4. Update all email templates to reference "Project Lazarus" with dark theme styling (void-black `#0A0A0F` background, rail-purple `#6E18B3` gradient headers)
5. Keep all other config identical: organization plugin, email verification, Google OAuth, session settings, rate limiting

**Fallback:** If the `database.provider: "pg"` approach doesn't work with the installed Better Auth version, use the Drizzle adapter:
```
import { drizzleAdapter } from "better-auth/adapters/drizzle"
```

---

### 0.8 Update Environment Variables

**File: `env.mjs`** (MODIFY)

**Task:** Update T3 Env schema to remove MongoDB and add Supabase, Gemini, OpenHands, and MCP server variables.

**Remove:**
- `MONGODB_URI`

**Add to `server` schema:**

| Variable | Validation | Purpose |
|----------|-----------|---------|
| `SUPABASE_URL` | URL string, optional | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | string, optional | Service role key for server-side access |
| `SUPABASE_DB_URL` | string, optional | Direct PostgreSQL pooler URL for Better Auth |
| `GEMINI_API_KEY` | string, optional | Google Gemini API key |
| `OPENHANDS_API_URL` | URL string, optional | OpenHands agent service URL |
| `LEFT_BRAIN_MCP_URL` | URL string, optional | Code-Synapse MCP server URL |
| `RIGHT_BRAIN_MCP_URL` | URL string, optional | Knowledge Extraction MCP server URL |
| `DEMO_MODE` | `"true"` / `"false"`, transform to boolean | Toggle demo mode for presentations |

**Add to `client` schema:**

| Variable | Validation | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL string, optional | Public Supabase URL for browser client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | string, optional | Public anon key for browser client |

**Add all new variables to `runtimeEnv` mapping.**

Keep all existing variables: `REDIS_URL`, `BETTER_AUTH_*`, `GOOGLE_*`, `RESEND_*`, `STRIPE_*`, `OPENAI_API_KEY`, PostHog, Sentry, etc.

---

### 0.9 Migrate Activity Feed to Supabase

**File: `lib/activity/feed.ts`** (MODIFY — replace entire contents)

**Task:** Replace all Mongoose operations with Supabase queries for the activity feed system.

**Functions to implement:**

| Function | Description | Query pattern |
|----------|-------------|--------------|
| `createActivity(data)` | Insert an activity record | `supabase.from("activities").insert(...)` |
| `getActivityFeed(orgId, options)` | Get paginated feed for an org | `.select("*").eq("organization_id", orgId).order("created_at", desc).limit(N)` with optional filters for userId, resource, resourceId, before cursor |
| `getUserActivity(userId, options)` | Get activities for a specific user | `.select("*").eq("user_id", userId).order("created_at", desc).limit(N)` |

**Activity types to support:** `user.created`, `user.updated`, `organization.created`, `organization.updated`, `member.invited`, `member.joined`, `project.created`, `project.updated`, `project.deleted`, `ai_agent.run`, `document.created`, `document.updated`, `comment.created`, `subscription.created`, `subscription.updated`

---

### 0.10 Migrate Audit Logger to Supabase

**File: `lib/audit/logger.ts`** (MODIFY — replace entire contents)

**Task:** Replace Mongoose audit operations with Supabase queries.

**Functions to implement:**

| Function | Description | Notes |
|----------|-------------|-------|
| `logAction(action, resource, options)` | Insert an audit log entry | Non-throwing — log errors to console but don't propagate |
| `getAuditLogs(filters)` | Query audit logs with filters | Support: userId, organizationId, action, resource, startDate, endDate, limit |

**Audit actions:** `create`, `read`, `update`, `delete`, `login`, `logout`, `invite`, `subscribe`, `cancel`, `admin_action`

---

### 0.11 Migrate Usage Tracker to Supabase

**File: `lib/usage/tracker.ts`** (MODIFY — replace entire contents)

**Task:** Replace Mongoose usage tracking with Supabase queries.

**Functions to implement:**

| Function | Description |
|----------|-------------|
| `trackUsage(data)` | Insert a usage record with userId, type, resource, quantity, optional cost |
| `getUsageStats(filters)` | Query and aggregate usage — return totalQuantity, totalCost, count, breakdown by resource |
| `checkQuota(userId, orgId, quota)` | Check if user is within quota limits for a given time window |

**Usage types:** `api_call`, `ai_request`, `storage`, `bandwidth`, `feature_usage`

---

### 0.12 Update Stripe Webhook for Supabase

**File: `app/api/webhooks/stripe/route.ts`** (MODIFY)

**Task:** Replace `connectDB()` + Mongoose model operations with Supabase queries.

**Key changes:**
1. Remove Mongoose imports and `connectDB()` call
2. Import `supabase` from `@/lib/db`
3. For `customer.subscription.created/updated`: Use `supabase.from("subscriptions").upsert(...)` with `onConflict: "stripe_subscription_id"`
4. For `customer.subscription.deleted`: Use `supabase.from("subscriptions").update({ status: "canceled" }).eq("stripe_subscription_id", id)`
5. Keep `triggerWebhook` calls unchanged
6. Add helper: `getPlanIdFromPriceId(priceId)` — maps Stripe price IDs to plan tiers

---

### 0.13 Update Admin Dashboard

**File: `app/(admin)/admin/page.tsx`** (MODIFY)

**Task:** Replace Prisma/Mongoose queries with Supabase for admin stats.

**Key changes:**
1. Remove Prisma/Mongoose imports
2. Use `supabase.from("user").select("*", { count: "exact", head: true })` for user count
3. Use similar pattern for org count and active subscription count
4. Use `getAuditLogs({ limit: 10 })` for recent activity
5. Keep the JSX layout and component structure the same

---

### 0.14 Update AI Tools

**File: `lib/ai/tools/index.ts`** (MODIFY)

**Task:** Replace the MongoDB `databaseTool` handler with a Supabase-based query tool.

**Key changes:**
- Import `supabase` from `@/lib/db` instead of Mongoose
- `databaseTool.handler`: Build a dynamic Supabase query using `.from(table).select("*").limit(limit)` with optional `.eq()` filters
- Keep `emailTool` and `webSearchTool` unchanged

---

### 0.15 Update Proxy (Protected Routes)

**File: `proxy.ts`** (MODIFY)

**Task:** Add `/projects` to the `protectedRoutes` array so the dashboard pages require authentication.

> 💡 **Tip:** Use `user-next-devtools-nextjs_docs` to verify middleware patterns for Next.js 16 if needed.

```
protectedRoutes: ["/dashboard", "/settings", "/billing", "/admin", "/projects"]
```

---

### 0.16 Supabase SQL Schema

**File: `docs/supabase-schema.sql`** (NEW — reference schema, run in Supabase SQL editor)

Schema lives in `docs/` as reference documentation. For migration workflows, copy to `supabase/migrations/` and use Supabase CLI.

**Task:** Create the PostgreSQL schema for all Lazarus tables.

**Tables to create** (Better Auth tables like `user`, `session`, `account`, `organization`, `member`, `invitation` are auto-managed):

| Table | Key constraints |
|-------|----------------|
| `projects` | UUID PK, status CHECK constraint, default `pending`, auto `updated_at` trigger |
| `project_assets` | UUID PK, FK to projects (CASCADE), type CHECK constraint |
| `vertical_slices` | UUID PK, FK to projects (CASCADE), status CHECK constraint, `dependencies UUID[]`, auto `updated_at` trigger |
| `agent_events` | UUID PK, FK to projects (CASCADE), FK to vertical_slices (SET NULL), event_type CHECK |
| `subscriptions` | UUID PK, UNIQUE on stripe_subscription_id, auto `updated_at` trigger |
| `activities` | UUID PK, organization_id NOT NULL |
| `audit_logs` | UUID PK |
| `usage` | UUID PK, user_id NOT NULL |

**Indexes to create:**
- `idx_projects_user` on projects(user_id)
- `idx_projects_org` on projects(org_id)
- `idx_project_assets_project` on project_assets(project_id)
- `idx_slices_project` on vertical_slices(project_id)
- `idx_agent_events_project` on agent_events(project_id)
- `idx_agent_events_slice` on agent_events(slice_id)
- `idx_agent_events_created` on agent_events(project_id, created_at DESC) — critical for real-time event streaming performance
- `idx_subscriptions_user` on subscriptions(user_id)
- `idx_activities_org` on activities(organization_id, created_at DESC)
- `idx_audit_logs_org` on audit_logs(organization_id, created_at DESC)
- `idx_usage_user` on usage(user_id, timestamp DESC)

**Realtime:** Enable Supabase Realtime on `agent_events` and `vertical_slices` tables:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE agent_events;
ALTER PUBLICATION supabase_realtime ADD TABLE vertical_slices;
```

**Storage buckets** (create via Supabase dashboard):
- `project-videos` — Uploaded video recordings
- `project-documents` — PDFs, markdown docs
- `project-screenshots` — Visual regression captures
- `agent-artifacts` — Generated code, test files, build outputs

**Auto-update trigger:** Create a `update_updated_at()` function and attach to `projects`, `vertical_slices`, and `subscriptions` tables.

---

<a id="phase-9"></a>
## PHASE 9: Dependencies & Enhancement Packages

### 9.0 Implementation Status

**Completed Tasks:**
- [x] **9.1 Full Dependency Changes:** All packages installed/removed.
- [x] **9.2 Audio Assets:** Sound system implemented with procedural fallback.
- [x] **9.3 Font Assets:** Fonts configured with explicit utilities.
- [x] **9.4 React Query Provider:** Added for data fetching hooks.
- [x] **9.5 Root Layout Metadata:** Updated to Project Lazarus branding.

### 9.1 Full Dependency Changes

**Add to `dependencies`:**

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client |
| `@supabase/ssr` | Supabase SSR/cookie helpers |
| `@google/genai` | Gemini SDK (structured outputs) |
| `@xyflow/react` | React Flow for dependency graph |
| `framer-motion` | Animations, transitions, Glass Brain theatrics |
| `use-sound` | Audio cue hooks for UI events |

**Remove:**

| Package | Reason |
|---------|--------|
| `@prisma/client` | Replaced by Supabase |
| `prisma` (devDep) | Replaced by Supabase |
| `mongoose` | Replaced by Supabase |
| `mongodb` | Replaced by Supabase |

**Keep unchanged:** `openai` (used by OpenHands indirectly), `bullmq` + `ioredis`, `stripe`, all Radix/shadcn packages, all testing packages (Vitest, Playwright, Storybook).

### 9.2 Audio Assets

**Task:** Add audio files to `public/sounds/` for immersive demo experience.

| File | Purpose | Specs |
|------|---------|-------|
| `keystroke.mp3` | Ghost Typer typing effect | Short click, ~50ms |
| `success.mp3` | Test pass / slice complete | Pleasant chime, ~300ms |
| `error.mp3` | Test failure | Low buzz/glitch, ~200ms |
| `heal.mp3` | Self-heal trigger | Ethereal whoosh, ~400ms |
| `confidence-tick.mp3` | Confidence gauge increment | Subtle tick, ~100ms |
| `boot-up.mp3` | Neural Handshake start | Sci-fi power-on, ~1s |

Use royalty-free sound effects or generate procedurally with Web Audio API at runtime as an alternative.

**Implementation:**
- `lib/sounds/constants.ts` — Sound URLs, keys, volume levels
- `lib/sounds/procedural.ts` — Web Audio API fallback (no files required)
- `lib/sounds/index.ts` — Barrel export
- `hooks/use-sound-effects.tsx` — Centralized hook using `use-sound` + procedural fallback
- `public/sounds/README.md` — Asset specs and sourcing instructions

When MP3 files are absent, procedural audio is used. Set `useFiles: true` in `useSoundEffects()` when files are added.

### 9.3 Font Assets

**Task:** Ensure these fonts are available (already partially configured in the boilerplate):

| Font | Usage | Weight |
|------|-------|--------|
| Space Grotesk (`font-grotesk`) | Headlines, confidence numbers, slice names | 600, 700 |
| JetBrains Mono (`font-mono`) | Code streaming, terminal output in Work Pane | 400 |
| Inter | Body text (already default) | 400, 500, 600 |

**Implementation:**
- `app/layout.tsx` — Space Grotesk, Inter, JetBrains Mono via `next/font/google`
- `styles/tailwind.css` — CSS variables (`--font-grotesk`, `--font-mono`) and `.font-grotesk`, `.font-mono` utility classes

### 9.4 React Query Provider

**File: `components/providers/query-provider.tsx`** (NEW)

**Task:** Add QueryClientProvider for client-side data fetching.

- Wraps app in `QueryClientProvider` with sensible defaults (staleTime 1 min)
- Lazy-initialized QueryClient to avoid SSR state sharing
- Referenced by Phase 7.3 hooks (`useProject`, `useSlices`)

### 9.5 Root Layout & Constants

**Files:** `app/layout.tsx`, `lib/utils/constants.ts` (MODIFY)

**Task:** Update metadata and constants for Project Lazarus branding.

- Title: "Project Lazarus - Reincarnate Legacy Software"
- Description: Platform transmutation value prop
- Keywords: legacy migration, AI agents, etc.
- `APP_DESCRIPTION`: "Reincarnate Legacy Software - AI-powered autonomous code migration"

---

## Verification Checklist (Phase 0 & 9)

**Status: ✅ COMPLETE**

**Phase 9 (no TODOs, mock data, or dummy data in Phase 9 scope):**
- [x] Dependencies: Phase 9.1 packages installed; MongoDB/Prisma removed
- [x] Audio: Procedural Web Audio API (real implementation); `useSoundEffects()` defaults to procedural
- [x] Fonts: Space Grotesk, Inter, JetBrains Mono; `.font-grotesk`, `.font-mono` utilities
- [x] React Query: QueryClientProvider wraps app; Phase 7 hooks can use `useQuery`
- [x] Branding: Layout metadata and constants updated to Project Lazarus

**Phase 0:**
- [x] `pnpm install` succeeds with no peer dependency conflicts
- [x] All MongoDB/Prisma files are deleted
- [x] `lib/db/index.ts` exports Supabase client and types
- [x] `env.mjs` validates correctly with new Supabase vars
- [x] Better Auth connects to PostgreSQL via Supabase
- [x] Auth flows work (login, register, verify-email) with Supabase
- [x] Admin dashboard loads with Supabase queries
- [x] Stripe webhook correctly upserts subscriptions via Supabase
- [x] Activity feed, audit logger, usage tracker all use Supabase
- [x] `pnpm build` completes without import errors

---

**End of Phase 0 & 9.** The UI implementation (Phases 1-4) continues in `docs/IMPLEMENTATION_PART2.md`.
