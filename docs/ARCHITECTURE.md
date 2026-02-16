# Architecture

Complete architecture documentation for Project Lazarus — The Legacy Code Necromancer.

---

## Overview & Vision

Project Lazarus is an autonomous AI agent that **transmutes legacy software into modern web applications** through an intelligent orchestration pipeline. Unlike traditional migration tools, Lazarus:

1. **Observes** legacy software behavior via video + document analysis (Right Brain)
2. **Understands** codebase structure and business intent (Left Brain — Code-Synapse)
3. **Plans** migration as vertical slices with testable feature contracts
4. **Builds** modern code slice-by-slice with autonomous verification
5. **Heals** through self-healing test loops with visible "Thought Signatures"
6. **Verifies** via bi-directional video diffing (Legacy vs. Modern)
7. **Modernizes** by detecting opportunities for MCP servers, chat interfaces, etc.
8. **Refines** through voice-driven live adjustments (Gemini Live API)

### Hackathon Strategy

| Track | Strength | Winning Feature |
|-------|----------|-----------------|
| **Marathon Agent** | Long-running autonomous pipeline | Glass Brain Dashboard + Thought Signatures |
| **Vibe Engineering** | Self-healing testing loops | Visual $0.01 Tax Fix Demo |

### Already Built: The Two Hemispheres

**Left Brain: Code-Synapse** — 24 language support with Tree-sitter parsing, knowledge graph in CozoDB with business justification, MCP server for AI agent integration, vibe coding workflow with change ledger, adaptive indexing and persistent memory.

**Right Brain: Knowledge Extraction System** — Video ingestion with Gemini Vision, screen/task extraction into structured JSON, ArangoDB graph for behavioral mapping, Phase 7 Verification with Playwright replay, Temporal-orchestrated workflow.

---

## The Lazarus Loop

The orchestration layer follows a cyclic pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THE LAZARUS LOOP v2.0                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │   INGEST    │────►│   ANALYZE   │────►│    PLAN     │                  │
│   │ Video+Code  │     │ Correlate   │     │   Slices    │                  │
│   └─────────────┘     └─────────────┘     └──────┬──────┘                  │
│                                                   │                          │
│   ┌─────────────────────────────────────────────┘                          │
│   ▼                                                                          │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │  GENERATE   │────►│   VERIFY    │────►│  CONFIDENCE │                  │
│   │   Code      │     │  Test+Vibe  │     │    Check    │                  │
│   └─────────────┘     └──────┬──────┘     └──────┬──────┘                  │
│         ▲                    │                    │                          │
│         │                    ▼                    ▼                          │
│         │              ┌───────────┐        ┌───────────┐                   │
│         │              │  FAILED   │        │  PASSED   │                   │
│         │              │ <85% conf │        │ ≥85% conf │                   │
│         │              └─────┬─────┘        └─────┬─────┘                   │
│         │                    │                    │                          │
│         └────────────────────┤                    ▼                          │
│              SELF-HEAL       │             ┌───────────┐                    │
│              (max 5 retries) │             │ MODERNIZE │                    │
│                              │             └─────┬─────┘                    │
│   ┌──────────────────────────┘                   │                          │
│   │                                              ▼                          │
│   │  ┌─────────────────────────────────────────────────────────────┐       │
│   │  │              REFINEMENT LOOP                                  │       │
│   │  ├─────────────────────────────────────────────────────────────┤       │
│   │  │  1. MONITOR: Playwright records video of new app            │       │
│   │  │       │                                                       │       │
│   │  │       ▼                                                       │       │
│   │  │  2. COMPARE: Gemini compares New vs Legacy Video             │       │
│   │  │       │                                                       │       │
│   │  │       ▼                                                       │       │
│   │  │  3. REFINE: CSS/Layout adjustments sent back to Code Gen    │       │
│   │  └─────────────────────────────────────────────────────────────┘       │
│   │                                              │                          │
│   └──────────────────────────────────────────────┘                          │
│                                                  ▼                          │
│                                            ┌───────────┐                    │
│                                            │  DEPLOY   │                    │
│                                            │  + Demo   │                    │
│                                            └───────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Ingest** — Accept legacy inputs: video recordings, documents, source code, screenshots. Assets are stored in Supabase Storage and queued for analysis.

**Analyze** — Correlate video behavior with code structure. The Left Brain (Code-Synapse) parses the codebase; the Right Brain (Knowledge Extraction) extracts tasks and behavior from video. Both run in parallel.

**Plan** — Produce a migration plan as vertical slices. Two-phase Gemini planner: Phase 1 (Architect) generates ordered migration plan (infra→auth→layout→pages). Phase 2 (Detail) generates implementation guides per slice in batches of 3.

**Generate** — Build modern code slice-by-slice. OpenHands SDK or local workspace drives code generation. Output streams to the Glass Brain Work pane.

**Verify** — Run unit tests (Vitest), E2E tests (Playwright), and visual regression. Compute confidence from test pass rates and visual/behavioral match.

**Confidence Check** — If confidence ≥ 85%, proceed to Modernize. If below, and retries fewer than 5, invoke Self-Heal.

**Self-Heal** — Diagnose failure via Thought Signature, propose a fix, regenerate code, and re-run verification.

**Modernize** — Apply optional enhancements: MCP server generation, chat interface, API endpoints.

**Refinement Loop** — Compare legacy vs. modern app via bi-directional video diff (Gemini). Apply layout/CSS fixes as needed.

---

## Glass Brain Dashboard

The Lazarus HUD visualizes agent cognition in real time.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           THE LAZARUS GLASS BRAIN HUD                                │
├─────────────────────┬─────────────────────────┬─────────────────────────────────────┤
│                     │                         │                                      │
│   THE PLAN          │   THE WORK              │   THE THOUGHTS                       │
│                     │                         │                                      │
│  ┌───────────────┐  │  ┌─────────────────┐   │  ┌────────────────────────────────┐  │
│  │ Login ────┬───│──│──│ Streaming Code  │   │  │ "Analysis: Legacy CardValidator │  │
│  │           │   │  │  │ Generation      │   │  │  uses Luhn algorithm.          │  │
│  │           ▼   │  │  │                 │   │  │                                │  │
│  │ Inventory │   │  │  │ src/lib/        │   │  │  Plan: Porting to TypeScript   │  │
│  │     │     │   │  │  │ checkout.ts     │   │  │  utils.                        │  │
│  │     ▼     │   │  │  │                 │   │  │                                │  │
│  │ Checkout ─┘   │  │  │ ████████░░ 80%  │   │  │  Constraint: Must match        │  │
│  │               │  │  │                 │   │  │  existing behavior in video    │  │
│  └───────────────┘  │  └─────────────────┘   │  │  timestamp 0:42."              │  │
│                     │                         │  └────────────────────────────────┘  │
│  Dependencies       │  Terminal Output       │                                      │
│  visualized as      │  with syntax           │  ┌────────────────────────────────┐  │
│  interactive        │  highlighting          │  │ LIVE CONFIDENCE GAUGE           │  │
│  graph              │                         │  │ ████████████░░░░░░░░  61%      │  │
│                     │                         │  │ ▲ Jitters as tests pass/fail  │  │
│                     │                         │  │ → Turns GREEN at 85%          │  │
│                     │                         │  └────────────────────────────────┘  │
└─────────────────────┴─────────────────────────┴─────────────────────────────────────┘
```

### Dashboard Panes

| Pane | Purpose | Data Source |
|------|---------|-------------|
| **Left: The Plan** | Visual dependency graph of vertical slices | Supabase `vertical_slices` table |
| **Center: The Work** | Terminal-like streaming code generation with tabs (Events, Browser, Screenshots) | Real-time agent events |
| **Right: The Thoughts** | Exposed Gemini "inner monologue" — Thought Signature cards | Thought Signatures |
| **Bottom: Confidence** | Live gauge that jitters with test results | `calculateConfidence()` |

### Thought Signature Format

Each Thought Signature contains:
- **Observation**: What the agent noticed (e.g., "Precision mismatch in tax calculation")
- **Legacy Context**: What the old code does (e.g., "Legacy Java code used BigDecimal")
- **Root Cause**: Why the problem exists (e.g., "IEEE 754 floating point error")
- **Strategy**: Proposed fix (e.g., "Library Adoption — decimal.js to mimic BigDecimal")
- **Confidence**: Numerical confidence in the strategy (0.0–1.0)

### Component Architecture

**Base Components (Phase 4):**
- `glass-brain-dashboard.tsx` — Main 3-pane layout with boot sequence animation
- `plan-pane.tsx` / `plan-pane-enhanced.tsx` — Interactive dependency graph with mini-cards, spotlight, progress bar
- `work-pane.tsx` / `work-pane-enhanced.tsx` — Streaming events with slice context headers, test cards, timestamps; tabbed (Events | Browser | Screenshots)
- `thoughts-pane.tsx` — Thought Signature card stream
- `confidence-gauge.tsx` — Animated gauge with sparkline, milestones, tooltip

**Enhanced Components (Phase 4 Upgrade — Demo-Worthy):**
- `derive-stats.ts` — Pure utility deriving event counts, phase, rates from events array
- `header-stats.tsx` — Rich header with live counters, agent status pulse, brain viz, phase indicator, MCP toggle
- `confidence-sparkline.tsx` — SVG confidence trajectory over time
- `activity-timeline.tsx` — Event density strip visualization
- `victory-lap.tsx` — Celebration overlay at 85% ("TRANSMUTATION COMPLETE", confetti, QR code)
- `ambient-effects.tsx` — Breathing glow + pane connection lines

**Build Experience Components (Phase 5 Upgrade):**
- `derive-build-phase.ts` — Derives build phase from event sequence
- `build-phase-indicator.tsx` — Shows current build phase with animation
- `cost-ticker.tsx` — Human estimate vs Lazarus cost comparison
- `agent-brain-viz.tsx` — Visual indicator of which "brain" is active
- `build-pipeline-tracker.tsx` — Multi-step pipeline visualization
- `build-narrative-bar.tsx` — Human-readable narration of what the agent is doing
- `self-heal-arc.tsx` — Self-healing cycle visualization (diagnosis → strategy → fix → verify)
- `mcp-tool-inspector.tsx` — Raw MCP tool calls and responses viewer
- `chaos-button.tsx` — Injects a failure for interactive demo

**Browser Testing Components (Phase 5B):**
- `browser-stream-panel.tsx` — noVNC iframe for live browser streaming
- `screenshot-gallery.tsx` — Screenshot events with lightbox viewer

### View States & Transitions

The dashboard uses a project-detail orchestrator with smooth view transitions:

| View | When | Components |
|------|------|------------|
| **Overview** | Project created, pending | Project info, asset list, action buttons |
| **Analysis** | Processing status | Dual console (Code Analysis + App Behaviour), pipeline tracker |
| **Analysis Config** | Pre-analysis configuration | Interactive config form for analysis parameters |
| **Slice Review** | Ready status | Plan Command Center (dependency graph, slice details) |
| **Glass Brain** | Building/paused status | Full 3-pane HUD with all enhanced components |
| **Complete** | All slices done | Summary, export options, retry/re-analyze |

### Design System

**Color Tokens:**
- Void Black: `#0a0a0f` (background)
- Rail Purple: `#a855f7` / `#7c3aed` (primary accent)
- Electric Cyan: `#22d3ee` (secondary accent)
- Confidence Red→Amber→Green gradient based on percentage

**Glassmorphism Pattern:**
- `bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl`
- Glow effects via `shadow-[0_0_30px_rgba(168,85,247,0.3)]`

**Typography:**
- Poppins Semi Bold (600) for headlines, navigation, buttons
- Poppins Regular (400) for body text
- JetBrains Mono / Fira Code for terminal output
- Sofia Sans Extra Condensed for accent labels only

**Animation Catalog:**
- CSS keyframes: `synapseFlow` (edge pulse), `particleFlow`, `glitchEffect`, `breathingGlow`
- Framer Motion: boot sequence (staggered pane reveal, +600ms), page transitions, card hover
- rAF counters for smooth numerical animations (confidence gauge, cost ticker)

---

## Vertical Slice Architecture

Traditional migrations rebuild by layer. Lazarus rebuilds by feature using vertical slices.

```
┌─────────────────────────────────────────────────────────────────┐
│                    VERTICAL SLICE SPEC                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  slice_id: "checkout_payment"                                   │
│  priority: 1  (execution order)                                 │
│  confidence_threshold: 0.85                                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  BEHAVIORAL CONTRACT (from Right Brain)                  │    │
│  │  - User enters card number, expiry, CVV                 │    │
│  │  - Click "Pay" → shows processing spinner               │    │
│  │  - Success → redirect to confirmation                    │    │
│  │  - Video Timestamp: 2:14-2:47                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  CODE CONTRACT (from Left Brain)                         │    │
│  │  - validateCard(number) → boolean                        │    │
│  │  - processPayment(cardData, amount) → PaymentResult     │    │
│  │  - Tax calculation: uses BigDecimal (precision!)         │    │
│  │  - Dependencies: PaymentGateway, TaxService              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  MODERNIZATION FLAGS                                     │    │
│  │  - [ ] Generate MCP server for payment processing        │    │
│  │  - [ ] Add chat interface for payment support            │    │
│  │  - [ ] Create REST API endpoint                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Dependencies: [auth_login, inventory_display]                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Slice Lifecycle:** `pending` → `selected` → `building` → `testing` → `self_healing` (on failure) → `complete` or `failed`.

**Benefits:** Each slice is self-contained and testable; incremental confidence; parallel execution; reduced risk.

**Two-Phase Gemini Planner:**
- Phase 1 (Architect): Generates ordered migration plan with dependency ordering (infra→auth→layout→pages). Each slice has `code_contract.files`, `implementation_steps`, `key_decisions`, `pseudo_code`, `verification`.
- Phase 2 (Detail): Generates IMPLEMENTATION.md-quality guides per slice in batches of 3. Partial batch failures don't block.

### Plan Command Center

The plan view is a full command center with:
- Animated stats bar (total slices, confidence, progress)
- Search/filter toolbar
- Topological dependency graph layout with synapse-animated edges
- Confidence rings per slice node
- Interactive detail sheet with tabs (Overview / Contracts / Dependencies)
- Dependency chain highlighting on hover
- MiniMap and view toggle (graph/list)
- "Build Next" / "Build This Slice" actions

**Topological Layout Pseudo Code:**
```
function layoutTopological(slices):
  adjacency = build dependency graph
  layers = [] // each layer = set of nodes at same depth
  visited = set()

  for each slice with no dependencies:
    BFS from slice, assigning layer = max(parent layers) + 1

  for each layer:
    distribute nodes horizontally with equal spacing
    y position = layer index * vertical gap

  return node positions
```

---

## Database Architecture

**Supabase (PostgreSQL):** Primary database for application data and auth.

**Auth Tables:** Managed by Better Auth (`user`, `session`, `account`, `organization`, `member`, `invitation`).

**Application Tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `projects` | Migration projects | `id`, `name`, `github_url`, `status`, `framework`, `confidence`, `pipeline_step`, `pipeline_checkpoint` (JSONB), `error_context` (JSONB), `current_slice_id`, `build_job_id`, `analysis_config` (JSONB) |
| `project_assets` | Uploaded files | `id`, `project_id` (FK CASCADE), `type` (video/document/screenshot/code), `storage_path`, `filename` |
| `vertical_slices` | Migration plan slices | `id`, `project_id` (FK CASCADE), `name`, `status`, `priority`, `confidence`, `dependencies[]`, `behavioral_contract`, `code_contract`, `retry_count` |
| `agent_events` | Real-time agent activity | `id`, `project_id` (FK CASCADE), `slice_id`, `event_type`, `data` (JSONB), `confidence`, `created_at` |
| `activities` | User activity feed | `id`, `user_id`, `org_id`, `type`, `metadata` |
| `audit_logs` | Security audit trail | `id`, `action`, `resource`, `resourceId`, `metadata`, `ipAddress` |
| `usage` | API/AI usage tracking | `id`, `user_id`, `type`, `count`, `metadata` |

**Agent Event Types:** `thought`, `tool_call`, `observation`, `code_write`, `test_run`, `test_result`, `self_heal`, `confidence_update`, `browser_action`, `screenshot`, `app_start`.

**Storage Buckets:** `project-videos`, `project-documents`, `project-screenshots`, `agent-artifacts`.

**Realtime:** Enabled on `agent_events` and `vertical_slices` for live Glass Brain updates.

**Delete Cascade:** `vertical_slices`, `agent_events`, `project_assets` all have `ON DELETE CASCADE` FK on `project_id`.

### Database Access Pattern

- **Server-Side:** Service Role client (`lib/db/supabase.ts`) — bypasses RLS, application-level authorization mandatory.
- **Client-Side:** Browser client (`lib/db/supabase-browser.ts`) — for Realtime subscriptions and future RLS features.
- **Type workaround:** `(supabase as any).from("tableName")` due to PostgrestVersion mismatch in Database types.

**Supabase Server Client Pseudo Code:**
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

## Authentication & Authorization

**Better Auth:** Email/password, Google OAuth, email verification, session management.

**Organization Plugin:** Optional multi-tenancy. Organizations, members, invitations, role-based access.

**Roles:** owner, admin, member, viewer. Permissions control project creation, viewing, and management.

**Protected Routes:** Dashboard, projects, settings, admin. Configured in `proxy.ts`.

**Auth Pattern:** `auth.api.getSession({ headers: await headers() })` — import `headers` from `next/headers`, `auth` from `@/lib/auth`.

---

## AI & Agent Architecture

### Gemini Integration

**Gemini** powers planning, Thought Signatures, confidence explanation, and video comparison.

- `lib/ai/gemini.ts` — Client initialization
- `lib/ai/gemini-planner.ts` — Two-phase migration planning (Architect + Detail)
- `lib/ai/thought-signatures.ts` — Thought Signature generation
- `lib/ai/confidence-explainer.ts` — Human-readable confidence explanations
- `lib/ai/schemas.ts` — Zod schemas for structured Gemini outputs

### OpenHands SDK

Code generation and editing via headless agent. Self-healing loop runs in agent system prompt.

### Code-Synapse Integration (Left Brain)

The Left Brain is **Code-Synapse CLI** — not an HTTP server.

**Architecture:**

| Assumption | Reality |
|------------|---------|
| Left Brain is a running HTTP server | Code-Synapse is a CLI tool that must be invoked |
| MCP endpoint is always available | MCP server starts via `code-synapse mcp` command |
| Analysis is an API call | Analysis requires `code-synapse index` + `code-synapse justify` |

**Correct Processing Flow:**
```
1. Clone/checkout target codebase to workspace
2. Run `code-synapse index <path>` (builds AST + knowledge graph)
3. Run `code-synapse justify <path>` (adds business justifications)
4. Start MCP: `code-synapse mcp --port 3100`
5. Query MCP tools for feature map, functions, classes, graph
6. When done, terminate MCP server
```

**Code-Synapse Viewer REST API (working endpoints):**
- `/api/stats/overview` — totalFiles, totalFunctions, totalClasses, totalInterfaces
- `/api/stats/entities` — entity breakdown
- `/api/stats/languages` — `[{language, fileCount, percentage}]`
- `/api/functions` — all parsed functions
- `/api/classes` — all parsed classes
- `/api/graph` — full nodes+edges with featureContext, justification
- `/api/justifications/stats` — justification statistics

**Feature Map Derivation:** Use `client.deriveFeatureMap()` which fetches `/api/graph` and groups nodes by `featureContext`.

**NOT working (returns HTML SPA fallback):** `/api/features`, `/api/patterns`, `/api/migration/*`, `/api/semantics/*`, `/api/search`, `/api/files`, `/api/graph/calls`, `/api/graph/dependencies`.

### Right Brain (Knowledge Extraction / App Behaviour Analysis)

- `right-brain-client.ts` — Knowledge Extraction Service (`RIGHT_BRAIN_API_URL`)
- Uses `projectId` as knowledge ID automatically
- Runs real ingestion with uploaded `project_assets` (downloads from Supabase Storage to `/tmp/lazarus-{id}/` first)
- Uses `local_files` (local file paths) not `s3_references`
- No `website_url` — Right Brain is video analysis only
- **Activation requires:** `RIGHT_BRAIN_API_URL` set AND uploaded assets (videos/docs). No assets = fallback to Code Analysis semantics.

### MCP Integration

- Left Brain (Code-Synapse): Codebase parsing, knowledge graph, business justification via CLI → REST API
- Right Brain (Knowledge Extraction): Video ingestion, task extraction, behavioral mapping

### Agent Events

Streamed to `agent_events` table for Glass Brain display. Event types: `thought`, `tool_call`, `observation`, `code_write`, `test_run`, `test_result`, `self_heal`, `confidence_update`, `browser_action`, `screenshot`, `app_start`.

---

## Job Queue Architecture

**BullMQ + Redis:** Background job processing with retries and prioritization.

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `email` | Email sending | 5 workers |
| `processing` | Long-running tasks | 3 workers |
| `webhooks` | External HTTP calls | 10 workers |
| `project-processing` | Left Brain → Right Brain → Gemini planner | 2 workers |
| `slice-build` | Individual slice builds | 2 workers |

---

## Pipeline Lifecycle & Checkpoint/Resume

The project processing pipeline (Left Brain → Right Brain → Gemini Planner) supports checkpointing, pause/resume, and structured error tracking. State is stored in the project row (not Redis) so it survives Redis restarts and is visible to the frontend.

### Pipeline Steps

`left_brain` → `right_brain` → `planning` → `slice:<id>` (per-slice build)

### Parallel Brains

`lib/pipeline/parallel-brains.ts` — shared orchestrator, sets both brain statuses, runs `Promise.all`, updates independently. Either brain failing is non-fatal — slices generated from whatever data is available.

### Checkpoint System

**Checkpoint (`pipeline_checkpoint` JSONB):** After each major step completes, a checkpoint is saved containing `completed_steps[]`, cached results (`left_brain_result`, `right_brain_result`), and metadata (`sandbox_id`, `mcp_url`, `slices_generated`). On resume, the worker loads the checkpoint and skips completed steps.

**Error Context (`error_context` JSONB):** When a step fails, structured error info is stored: `step`, `message`, `timestamp`, `retryable`, `stack`. Displayed on the project detail page and cleared on resume/retry.

### Pipeline Types

```
PipelineStep = "left_brain" | "right_brain" | "planning" | "slice:<id>"

PipelineCheckpoint = {
  completed_steps: PipelineStep[]
  left_brain_result?: Record<string, unknown>
  right_brain_result?: Record<string, unknown>
  sandbox_id?: string
  mcp_url?: string
  slices_generated?: boolean
  last_updated: string  // ISO timestamp
}

ErrorContext = {
  step: string
  message: string
  timestamp: string
  retryable: boolean
  stack?: string
  details?: Record<string, unknown>
}

MAX_SLICE_RETRIES = 5
CONFIDENCE_THRESHOLD = 0.85
```

### Pipeline Orchestrator

All functions use `(supabase as any).from()` pattern. Pipeline audit events use `event_type: "thought"` with `metadata.pipeline_event` field — no new `AgentEventType` values (avoids cascading updates to all exhaustive `Record<AgentEventType, ...>` maps in UI).

| Function | Purpose |
|----------|---------|
| `saveCheckpoint(projectId, checkpoint)` | Updates `pipeline_checkpoint` JSONB + `pipeline_step`, inserts audit event |
| `loadCheckpoint(projectId)` | Returns `PipelineCheckpoint | null` from project row |
| `advancePipelineStep(projectId, step)` | Updates `pipeline_step` column |
| `setErrorContext(projectId, error)` | Stores structured error + inserts audit event |
| `clearErrorContext(projectId)` | Sets `error_context = null` |
| `storeBuildJobId(projectId, jobId)` | Stores BullMQ job ID for cancellation |
| `canResume(project)` | Returns true if checkpoint exists and status is `failed`/`paused` |
| `clearCheckpoint(projectId)` | Resets all pipeline state columns to null/empty |

### Slice Builder (Event-Driven Orchestration)

Event-driven orchestration — no polling. Called from events route when slices complete.

| Function | Purpose |
|----------|---------|
| `startBuildPipeline(projectId, userId)` | Sets project status="building", triggers first slice |
| `triggerNextSliceBuild(projectId, userId)` | Finds next buildable slice, chains on completion |
| `onSliceComplete(projectId, sliceId, userId)` | Marks slice complete, triggers next slice |
| `onSliceFailed(projectId, sliceId, userId)` | Increments retry count: under max → self_healing, over max → failed |

**Logic flow:**
- All complete → project status="complete"
- Any actively building → wait
- Any failed → stop pipeline for user intervention
- Find next: status=pending/selected, all deps complete → build it

### Worker Checkpoint Flow

**Pseudo code for `processProjectJob`:**
```
1. Store job.id via storeBuildJobId()
2. Load checkpoint (or init empty)
3. Clear previous error context
4. LEFT BRAIN: skip if done, else run + save checkpoint
5. PAUSE CHECK: query status, exit if "paused"
6. RIGHT BRAIN: skip if done, else run + save checkpoint
7. PAUSE CHECK
8. PLANNING: skip if done, else DELETE existing slices → generate → insert → save checkpoint
9. Set status="ready", clear build_job_id

On error: setErrorContext() with step name + message + stack, then status="failed"
```

### Pause/Resume

The "Pause" action sets status to `paused` and attempts to cancel the BullMQ job. The worker checks for `paused` status between steps and exits gracefully. Resume clears the error and re-queues — the worker loads the checkpoint and continues.

### Smart Retry

`POST /api/projects/[id]/retry?mode=resume|restart|auto`:
- `resume` — keeps the checkpoint
- `restart` — clears checkpoint and resets brain statuses
- `auto` — resumes if checkpoint exists, otherwise restarts

### Event → Status Transitions

`handleEventSideEffects()` runs after event insert + confidence update:

| Event | Side Effect |
|-------|-------------|
| `test_run` | slice.status = "testing" (skip if already testing) |
| `test_result` + passed + confidence ≥ 0.85 | `onSliceComplete()` → triggers next slice |
| `test_result` + failed | `onSliceFailed()` → retry or mark failed |
| `self_heal` | slice.status = "self_healing" |

### Status Values

`pending` → `processing` → `ready` → `building` → `complete`. Failure at any point → `failed`. User pause → `paused`. Both `failed` and `paused` support resume from checkpoint.

---

## Verification & Self-Healing

### Test Tiers

| Tier | Tool | Purpose |
|------|------|---------|
| Unit | Vitest | Function-level correctness |
| E2E | Playwright | User flow verification |
| Visual Regression | Screenshot comparison | Layout/styling match |
| Behavioral Match | Contract validation | Input/output matching |
| Video Comparison | Gemini | Legacy vs modern video diff |

### Confidence Calculation

Weighted combination of: unit pass rate, E2E pass rate, visual match, behavioral match, and video similarity.

**Threshold:** 85% default; higher for critical slices (e.g., payment, auth).

### Self-Healing Prompt Chain

Four-link chain, each a separate Gemini prompt building on the previous:

```
┌───────────────────────┐
│ 1. DIAGNOSIS PROMPT   │
│ "What failed and why?"│
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│ 2. STRATEGY PROMPT    │
│ "How should we fix?"  │
│ (produces Thought     │
│  Signature)           │
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│ 3. EXECUTION PROMPT   │
│ "Write the fix code"  │
└──────────┬────────────┘
           ▼
┌───────────────────────┐
│ 4. VERIFICATION PROMPT│
│ "Did the fix work?"   │
└───────────────────────┘
```

Max 5 retries per slice. Failed slices after max retries stop the pipeline for manual intervention.

---

## Video Diff & Refinement

**Purpose:** Compare legacy app recording with Playwright replay of modern app.

```
┌─────────────────────────────────────────────────────────────────┐
│                  BI-DIRECTIONAL VIDEO DIFFING                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐          ┌─────────────────┐              │
│  │ Legacy App      │          │ Modern App      │              │
│  │ Recording       │          │ (Playwright)    │              │
│  │ (from user)     │          │                 │              │
│  └────────┬────────┘          └────────┬────────┘              │
│           │                            │                        │
│           └──────────┬─────────────────┘                        │
│                      ▼                                          │
│           ┌─────────────────────┐                               │
│           │  Gemini Vision      │                               │
│           │  Comparison         │                               │
│           └──────────┬──────────┘                               │
│                      │                                          │
│                      ▼                                          │
│           ┌─────────────────────────────────────┐              │
│           │ Output:                              │              │
│           │ - visual_similarity: 0.89            │              │
│           │ - timing_match: 0.92                 │              │
│           │ - violations:                        │              │
│           │   - "Button color at 0:14"           │              │
│           │   - "Layout shift at 0:23"           │              │
│           │ - auto_fix_suggestions:              │              │
│           │   - "Change bg-blue-500 to #1a73e8"  │              │
│           └─────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

**Refinement:** Violations (e.g., color mismatch) fed back to code generation for CSS/layout fixes.

---

## Modernization Detection

During analysis, Lazarus identifies opportunities to modernize beyond 1:1 migration:

| Pattern Detected | Modernization Opportunity |
|-----------------|--------------------------|
| REST API with complex query params | GraphQL endpoint generation |
| Form-based data entry | Chat interface with natural language |
| Scheduled batch processing | Real-time event streaming |
| Monolithic business logic | MCP server for AI integration |
| Manual report generation | Auto-generated dashboards |
| Static configuration files | Dynamic feature flags |

---

## UI/UX Design System

### Color System

| Color | Hex | Usage |
|-------|-----|-------|
| Void Black | `#0a0a0f` | Primary background |
| Rail Purple | `#a855f7` | Primary accent, active states |
| Deep Purple | `#7c3aed` | Gradient endpoints, hover states |
| Electric Cyan | `#22d3ee` | Secondary accent, links |
| Cornflower Blue | `#568AFF` | Brand primary, buttons |
| Green-Blue | `#0665BA` | Secondary, gradient endpoints |
| Rich Black | `#001320` | Text on light backgrounds |

### Typography Hierarchy

| Level | Font | Weight | Size | Usage |
|-------|------|--------|------|-------|
| H1 | Poppins | 600 | 36px / 2.25rem | Page titles |
| H2 | Poppins | 600 | 30px / 1.875rem | Section headers |
| H3 | Poppins | 600 | 24px / 1.5rem | Card titles |
| Body | Poppins | 400 | 16px / 1rem | General text |
| Small | Poppins | 400 | 14px / 0.875rem | Labels, metadata |
| Code | JetBrains Mono | 400 | 14px | Terminal output, code |
| Accent | Sofia Sans Extra Condensed | 700 | varies | Tags, status labels only |

### Spacing Scale (4px grid)

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Inline element gaps |
| `space-2` | 8px | Icon-to-text, tight groups |
| `space-3` | 12px | Default padding |
| `space-4` | 16px | Card inner padding |
| `space-6` | 24px | Section spacing |
| `space-8` | 32px | Page section gaps |

### Component Patterns

**Cards:** Glassmorphic containers with `bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl`. Hover: `border-purple-500/30` + subtle scale.

**Buttons:**
- Primary: gradient `bg-gradient-to-r from-purple-600 to-blue-600`, white text
- Secondary: `bg-white/10 border border-white/20`, white text
- Danger: `bg-red-600/20 border border-red-500/30`, red text
- Ghost: transparent, white text, hover `bg-white/5`

**Forms:** Dark inputs with `bg-white/5 border border-white/10`, focus `border-purple-500 ring-purple-500/20`.

**Loading States:** Skeleton with shimmer animation (never spinners alone). Pulsing dots for AI "thinking".

**Empty States:** Centered illustration + message + CTA button. Never blank pages.

### Motion Design

| Context | Duration | Easing |
|---------|----------|--------|
| Micro-interactions (hover, focus) | 150ms | ease-out |
| Panel transitions | 300ms | ease-in-out |
| Page transitions | 400ms | spring(0.5, 0.8) |
| Boot sequence | 2400ms | staggered ease-out |
| Glass Brain pane reveal | 600ms stagger | ease-out |

### Quality Anti-Patterns

Avoid: spinners without context, walls of text, inconsistent spacing, hardcoded colors, z-index wars, missing loading/error/empty states, generic "Something went wrong" messages.

---

## Production Pipeline

### Processing Pipeline

A single production pipeline processes every project. The worker (`lib/queue/workers.ts`) routes all jobs through `processProjectJob`.

1. Spawns `code-synapse viewer` for the target codebase (`lib/code-synapse/process-manager.ts`)
2. Left Brain + Right Brain analysis run in parallel (`lib/pipeline/parallel-brains.ts`)
3. Multi-prompt Gemini planner generates ordered slices

### Building

**Local Workspace (`lib/workspace/local-workspace.ts`):**
- Pure Node.js `fs` + `child_process` (no Docker/Daytona needed)
- Clones boilerplate to `$WORKSPACE_ROOT/<projectId>/`
- Runs `pnpm install`, Playwright install
- Dev server killed via process group SIGTERM in try/finally
- `lib/build/slice-builder.ts` builds each slice in a local workspace sandbox
- `buildSlice()` is fire-and-forget

### Key Pipeline Modules

| Module | Path | Purpose |
|--------|------|---------|
| AI Codegen | `lib/ai/gemini-codegen.ts` | Generates code contracts from Gemini |
| Sandbox Manager | `lib/workspace/sandbox-manager.ts` | Manages build sandboxes |
| Slice Builder | `lib/build/slice-builder.ts` | Orchestrates individual slice builds |
| Pipeline Helpers | `lib/pipeline/helpers.ts` | `sleep`, `insertThought`, `pacedLog` |
| Process Utils | `lib/utils/process.ts` | `isPortOpen`, `killProcessOnPort` |
| Code-Synapse Mgr | `lib/code-synapse/process-manager.ts` | Code-Synapse process lifecycle |
| Asset Downloader | `lib/pipeline/asset-downloader.ts` | Downloads project assets from storage |
| Left Brain Runner | `lib/pipeline/left-brain.ts` | Runs Left Brain (code analysis) |
| Right Brain Runner | `lib/pipeline/right-brain.ts` | Runs Right Brain (behavioral analysis) |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-side) |
| `SUPABASE_DB_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `BETTER_AUTH_SECRET` | Yes | Auth secret (32+ chars) |
| `BETTER_AUTH_URL` | Yes | App URL for auth |
| `REDIS_URL` | No | Redis URL (default: localhost:6379) |
| `GEMINI_API_KEY` | No | Gemini AI API key |
| `OPENHANDS_API_URL` | No | OpenHands agent URL |
| `CODE_SYNAPSE_PATH` | No | Path to code-synapse CLI |
| `RIGHT_BRAIN_API_URL` | No | Knowledge Extraction Service URL |
| `WORKSPACE_ROOT` | No | Root directory for local slice build workspaces |
| `GOOGLE_CLIENT_ID` | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth |
| `RESEND_API_KEY` | No | Email service |

Environment variables managed via T3 Env (`env.mjs`) with Zod validation.

### Supabase Configuration

**Database architecture:**

| Concern | Technology | Connection |
|---------|-----------|------------|
| Authentication | Better Auth | `SUPABASE_DB_URL` (direct PostgreSQL) |
| Application Data | Supabase Client | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (REST API) |

**Connection string format:** `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

---

## Docker & Deployment

### Docker Compose Services

| Service | Image | Purpose |
|---------|-------|---------|
| `lazarus-app` | Next.js dev | Development server with hot reloading |
| `lazarus-worker` | Node.js | Background job processor |
| `lazarus-redis` | redis:7-alpine | Job queue backend (persisted data) |
| `lazarus-openhands` | ghcr.io/all-hands-ai/openhands:latest | Autonomous code generation agent |
| `lazarus-novnc` | theasp/novnc | Live browser streaming for testing |

### Workspace Strategy

| Strategy | When to Use |
|----------|-------------|
| **Local Workspace** (recommended) | Pure Node.js fs+child_process, no external deps |
| **Daytona** (recommended for production) | Managed dev environments with automatic cleanup |
| **Docker** | Isolated builds with pre-built images |

---

## Security

**Authentication:** Session validation on protected routes and API calls.

**Multi-Tenancy:** Organization membership verified before data access.

**AI Agents:** Tool inputs validated; rate limits on agent API; audit logging of agent interactions.

**Webhooks:** HMAC signature verification if external webhooks are used.

---

## Performance

**Database:** Indexes on frequently queried fields (`user_id`, `org_id`, `project_id`, `created_at`).

**Realtime:** Supabase Realtime for `agent_events` and `vertical_slices` to minimize polling.

**Job Queues:** Concurrency tuned per queue; prioritization for critical jobs. Worker concurrency at 2.

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | Health check (also `/healthz`, `/health`, `/ping`) |
| `/api/auth/*` | * | Better Auth endpoints |
| `/api/projects` | GET/POST | List / Create project |
| `/api/projects/[id]` | GET/PATCH/DELETE | Get / Update / Delete project (PATCH pause cancels BullMQ job) |
| `/api/projects/[id]/process` | POST | Start project processing pipeline |
| `/api/projects/[id]/retry` | POST | Smart retry (`?mode=resume\|restart\|auto`) |
| `/api/projects/[id]/resume` | POST | Resume from checkpoint |
| `/api/projects/[id]/build` | POST | Start automated build pipeline for all slices |
| `/api/projects/[id]/configure` | POST | Set analysis configuration |
| `/api/projects/[id]/events` | GET/POST | Get / Insert agent events (POST triggers status transitions) |
| `/api/projects/[id]/slices/[sliceId]/build` | POST | Build a single slice |
| `/api/projects/[id]/slices/[sliceId]/retry` | POST | Retry a failed slice |
| `/api/mcp/left-brain` | POST | Code-Synapse MCP proxy |
| `/api/mcp/right-brain` | POST | Knowledge Extraction MCP proxy |
| `/api/gemini` | POST | Gemini AI proxy |
| `/api/testing/seed` | POST | Seed test user (dev mode only, 403 in production) |

---

## Project Phases

Implementation follows a dependency-ordered phase structure:

```
Phase 0 (Foundation — MUST BE FIRST)
  ├── Phase 1 (Core UI Shell)
  ├── Phase 6 (Gemini Client)
  └── Phase 9 (Dependencies)
       ├── Phase 2 (Upload & Ingestion)
       │    └── Phase 3 (Plan Command Center)
       │         └── Phase 4 (Glass Brain Dashboard)
       │              └── Phase 5 (OpenHands SDK)
       │                   └── Phase 5B (Browser Testing & Live View)
       │                        └── Pipeline Lifecycle (Checkpoint/Resume)
       ├── Phase 7 (Testing Strategy)
       └── Phase 8 (Landing Page & Demo Mode)
```

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 0** | Database migration to Supabase, env vars, dependencies | Complete |
| **Phase 1** | Core UI shell, routing, sidebar, logo, Neural Activity Pulse | Complete |
| **Phase 2** | Upload flow, ingestion, 10 API routes, Left Brain + Right Brain + worker | Complete |
| **Phase 3** | Plan Command Center — dependency graph, stats, filter, detail sheet | Complete |
| **Phase 4** | Glass Brain Dashboard — base 6 files + 8 enhanced + 3 modified | Complete |
| **Phase 5** | OpenHands SDK — Docker Compose, worker concurrency, build route | Complete |
| **Phase 5 Upgrade** | Demo-worthy build experience — 9 new + 4 modified files | Complete |
| **Phase 5B** | Browser testing, noVNC, screenshot gallery, 3 new event types | Complete |
| **Phase 6** | Gemini integration — planner, thought signatures, confidence, schemas | Complete |
| **Phase 7** | Testing strategy — Vitest, Playwright, Storybook | Spec |
| **Phase 8** | Production pipeline — local workspace, slice builder, brain runners | Complete |
| **Pipeline Lifecycle** | Checkpoint/resume, pause, smart retry, event-driven slice orchestration | Complete |
| **Analysis Config** | Interactive configuration before analysis | Complete |
| **Local Build** | Local workspace for builds (no Docker/Daytona) | Complete |
| **View Transitions** | Smooth orchestrated view transitions | Complete |
| **Glass Brain Retry + Export** | Retry/export from Glass Brain header | Complete |

---

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `lib/auth/` | Better Auth configuration |
| `lib/db/` | Supabase client, browser client, types |
| `lib/ai/` | Agent runner, tools, Gemini integration, schemas |
| `lib/queue/` | BullMQ queues and workers |
| `lib/pipeline/` | Pipeline orchestrator, slice builder, parallel brains, brain runners, types |
| `lib/build/` | Slice builder (build sandbox orchestration) |
| `lib/code-synapse/` | Code-Synapse process manager |
| `lib/workspace/` | Local workspace manager, sandbox manager |
| `lib/activity/` | Activity feed |
| `lib/audit/` | Audit logging |
| `lib/usage/` | Usage tracking |
| `components/ai/glass-brain/` | All Glass Brain Dashboard components (~25 files) |
| `components/projects/` | Project card, list, upload zone, detail actions, orchestrator |
| `components/slices/` | Slice graph, card, list, status badge, detail sheet |
| `app/(dashboard)/` | Projects list, project detail, plan page |
| `app/(auth)/` | Login, register, verify-email |
| `app/api/projects/` | All project API routes |
| `hooks/` | `use-agent-events`, `use-project-polling`, custom hooks |

---

## Resources

- Better Auth Organization Docs
- Supabase Documentation
- BullMQ Documentation
- Code-Synapse CLI Documentation
- Gemini API Documentation
- OpenHands SDK Documentation
- React Flow Documentation
- Framer Motion Documentation
