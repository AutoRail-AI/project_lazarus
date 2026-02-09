# Project Lazarus - Implementation Guide (Part 3: Phases 5-8)

Continues from `IMPLEMENTATION_PART2.md` (Phases 1-4). This document covers the backend integration, AI services, testing strategy, landing page, and demo mode with all theatrical enhancements.

**Phase 2 Status:** ✅ Complete. See [IMPLEMENTATION_PART2.md - Phase 2 Verification](IMPLEMENTATION_PART2.md#phase-2-verification-checklist) for the full checklist, including project detail actions (Stop/Delete), DELETE API, API logging, Redis handling, and Supabase migrations.

**Phase 5 Status:** ✅ Complete. Queue system, MCP proxies, slice build route, Docker Compose with OpenHands, and env vars all implemented.

**Phase 5 Upgrade Status:** ✅ Complete. Demo-worthy build experience with 9 new components + 4 modified files — narrative bar, pipeline tracker, brain viz, self-heal arc, MCP inspector, cost ticker, chaos button, phase indicator.

**Phase 5B Status:** ✅ Complete. Autonomous browser testing & live view — 3 new event types, noVNC Docker service, tabbed Work Pane (Events | Browser | Screenshots), screenshot gallery, test credential seeding, and full integration across derive-stats, derive-build-phase, narrative bar, pipeline tracker, sound effects.

**Pipeline Lifecycle Status:** ✅ Complete. Checkpoint/Resume system — checkpointing at each pipeline step, smart resume/retry, automated slice-by-slice building, event-driven status transitions, real job cancellation on stop, structured error tracking.

**Reference Documentation:**
- [Ideation & Vision](project_lazarus.md)
- [System Architecture](ARCHITECTURE.md)
- [UI/UX Design System](UI_UX_GUIDE.md)
- [Brand Guidelines](../brand/brand.md)

---

<a id="phase-5"></a>
## PHASE 5: OpenHands SDK Integration (Marathon Agent Track)

### 5.1 Queue System Updates

> **Architecture Note:** While this implementation uses BullMQ for simplicity, for a true "Marathon Agent" architecture, consider using **Temporal** (`@temporalio/client`) to orchestrate the long-running project processing workflow. Temporal handles retries, long sleeps, and complex state management more robustly than message queues. The implementation below describes the BullMQ approach, but the structure is compatible with a Temporal Activity/Workflow migration.

**File: `lib/queue/types.ts`** (MODIFY)

**Task:** Add a new job data type for project processing.

**Add:**
- `ProjectProcessingJobData` interface with fields: `projectId`, `userId`, `githubUrl` (nullable), `targetFramework`, `assetIds` (optional string array)
- Update the `JobData` union type to include the new type
- Add `PROJECT_PROCESSING: "project-processing"` to `QUEUE_NAMES`

---

**File: `lib/queue/queues.ts`** (MODIFY)

**Task:** Add a project processing queue.

**Key steps:**
1. Import the new `ProjectProcessingJobData` type
2. Create `getProjectProcessingQueue()` function following the same lazy-init pattern as existing queues
3. Create `queueProjectProcessing(data, options?)` helper with the same pattern as `queueEmail`, `queueProcessing`, `queueWebhook`
4. Update `closeAllQueues()` to include the new queue

---

**File: `lib/queue/workers.ts`** (MODIFY)

**Task:** Add a project processing worker that orchestrates the Two Brains analysis pipeline.

**Worker: `processProjectJob`**

> 💡 **Note:** `LEFT_BRAIN_MCP_URL` and `RIGHT_BRAIN_MCP_URL` refer to the **custom** MCP servers defined in `docs/ARCHITECTURE.md`, not the system MCP tools available to Cursor.

**Flow:**

> **⚠️ Left Brain Architecture:** The Left Brain is **Code-Synapse CLI**, not an HTTP server. See [PHASE2_LEFT_BRAIN_INTEGRATION.md](PHASE2_LEFT_BRAIN_INTEGRATION.md) for the correct flow: checkout repo → run `code-synapse index` → `code-synapse justify` → start MCP server → query MCP tools (get_feature_map, get_slice_dependencies, get_migration_context). **Must wait for CLI completion before generating slices.**

```
1. Insert initial "thought" event: "Beginning project analysis..."
2. updateProgress(10%)

3. IF githubUrl provided (Left Brain — Code-Synapse CLI):
   a. Update project.left_brain_status = "processing"
   b. Insert "tool_call" event: "Checkout repository: {url}"
   c. Clone repo to workspace: git clone {url} {workspacePath}
   d. Insert "tool_call" event: "Indexing codebase (Code-Synapse)"
   e. Run: code-synapse index (cwd: workspacePath) — WAIT for completion
   f. Run: code-synapse justify (cwd: workspacePath) — WAIT for completion
   g. Run: code-synapse start --port {port} (background)
   h. Query MCP: get_feature_map, get_slice_dependencies, get_migration_context
   i. Store in project.metadata.code_analysis
   j. Update left_brain_status = "complete", insert "observation": "Code analysis complete"
   k. On failure: left_brain_status = "failed", log error

4. updateProgress(40%)

5. IF RIGHT_BRAIN_MCP_URL configured:
   a. Update project.right_brain_status = "processing"
   b. Fetch project_assets from Supabase
   c. IF assets exist:
      - Insert "tool_call" event: "Analyzing {N} knowledge assets"
      - POST to RIGHT_BRAIN_MCP_URL with { method: "extract_behaviors", params: { assets } }
      - On success: update right_brain_status = "complete"
      - Insert "observation" event: "Behavioral analysis complete"
      - On failure: update right_brain_status = "failed"

6. updateProgress(70%)

7. Generate vertical slices:
   a. Insert "thought" event: "Generating vertical slices from analysis..."
   b. Import and call generateSlices(project) from lib/ai/gemini-planner
   c. Insert each generated slice into vertical_slices table
   d. On failure: log error, continue

8. updateProgress(100%)

9. Update project.status = "ready"
10. Insert final "thought" event: "Analysis complete. Migration plan is ready." with confidence_delta +0.1
```

**Important:** Import Supabase lazily inside the worker function (`await import("@/lib/db/supabase")`) to avoid build-time issues.

**Register the worker in `startWorkers()`:**
- Queue name: `QUEUE_NAMES.PROJECT_PROCESSING`
- Processor: `processProjectJob`
- Concurrency: 2

---

### 5.2 OpenHands Agent Architecture

**Overview:** The Next.js frontend triggers builds, and a Python-based OpenHands service handles the actual code generation autonomously.

```
Next.js Frontend
  │
  ▼ (POST "build this slice")
/api/projects/[id]/slices/[sliceId]/build/route.ts
  │
  ▼ (POST with payload to external service)
Python OpenHands Service (at OPENHANDS_API_URL)
  │
  ├── Uses Code-Synapse MCP tools (query code graph, get contracts)
  ├── Uses Knowledge Extraction tools (get behavioral contracts, screenshots)
  ├── Uses Playwright (open browser, test, screenshot)
  ├── Uses terminal (run npm test, npm install, etc.)
  │
  └── Streams events back via HTTP callback
       │
       ▼ (POST to callback URL)
  /api/projects/[id]/events/route.ts
       │
       ▼
  INSERT INTO agent_events (Supabase)
       │
       ▼ (Realtime broadcast)
  Glass Brain Dashboard (live update)
```

### 5.3 OpenHands Agent MCP Tools

The OpenHands `CodeActAgent` receives these MCP tools:

| Tool | Source | Purpose |
|------|--------|---------|
| `code_synapse.get_code_contract` | Left Brain | Get implementation spec for a module |
| `code_synapse.get_dependency_graph` | Left Brain | Get module dependencies |
| `code_synapse.read_file` | Left Brain | Read files from analyzed repo |
| `knowledge.get_behavioral_contract` | Right Brain | Get expected user behavior |
| `knowledge.get_screen_recording` | Right Brain | Get relevant video clips |
| `knowledge.compare_screenshots` | Right Brain | Visual regression check |
| `browser.navigate` | Playwright | Navigate to URL in browser |
| `browser.screenshot` | Playwright | Take screenshot of running app |
| `file.write` | Built-in | Write generated code files |
| `file.read` | Built-in | Read generated code files |
| `terminal.run` | Built-in | Run shell commands (npm test, etc.) |

### 5.4 Self-Healing Loop (Test-First)

This logic is encoded in the OpenHands agent's system prompt, not in Next.js:

```
FOR each slice:
  1. READ behavioral contract + code contract
  2. GENERATE tests first (Vitest unit + Playwright E2E) based on contracts
  3. WRITE implementation code to make tests pass
  4. RUN unit tests via terminal
  5. RUN E2E tests via Playwright
  6. TAKE screenshots, compare with Right Brain
  7. CALCULATE confidence score
  8. IF confidence >= 85%:
       EMIT "slice_complete" event → STOP
  9. ELSE:
       EMIT "self_heal" event with diagnosis
       INCREMENT retry_count
       IF retry_count > 5: EMIT "slice_failed" → STOP
       DIAGNOSE failures using Gemini (generate Thought Signature)
       FIX code based on diagnosis
       GOTO step 4
```

Each step emits events to the callback URL, which inserts into `agent_events` for real-time dashboard display.

**Enhancement — Self-Healing Climax Staging:**
The self-healing loop is the most dramatic moment in the demo. The system prompt should instruct the agent to emit events that clearly communicate the "arc":
1. **Failure detection**: Clear error message with specifics
2. **Diagnosis pause**: A 2-3 second deliberate pause (the agent "thinking") before the diagnosis thought
3. **Root cause**: A specific, human-readable explanation of what went wrong
4. **Fix plan**: What the agent will change
5. **Retry**: Execute and report new results

This creates a narrative arc: tension (failure) → insight (diagnosis) → resolution (fix) → triumph (pass).

**Enhancement — Trap Indicator:**
In demo mode, intentionally introduce a known-fixable bug in generated code (e.g., missing export, wrong import path) so the self-healing loop is guaranteed to trigger at least once. This ensures judges always see the self-healing in action.

---

### 5.5 Docker Compose Update

**File: `docker-compose.yml`** (MODIFY)

**Task:** Add OpenHands service and update container names.

**Add service `openhands`:**
- Image: `ghcr.io/all-hands-ai/openhands:latest`
- Container name: `lazarus-openhands`
- Environment: `GEMINI_API_KEY`, `LEFT_BRAIN_MCP_URL=http://app:3000/api/mcp/left-brain`, `RIGHT_BRAIN_MCP_URL=http://app:3000/api/mcp/right-brain`, `CALLBACK_BASE_URL=http://app:3000`
- Volume: `openhands_workspace:/workspace`
- Port mapping: `3001:3000`
- Depends on: `app`

**Rename containers:**
- `modern-boilerplate-app` → `lazarus-app`
- `modern-boilerplate-worker` → `lazarus-worker`
- `modern-boilerplate-redis` → `lazarus-redis`

**Add volume:** `openhands_workspace`

---

### Phase 5 Verification Checklist

**Status: ✅ COMPLETE**

- [x] `lib/queue/types.ts` — `ProjectProcessingJobData` interface, `PROJECT_PROCESSING` queue name
- [x] `lib/queue/queues.ts` — `getProjectProcessingQueue()`, `queueProjectProcessing()`, included in `closeAllQueues()`
- [x] `lib/queue/workers.ts` — `processProjectJob` with full Left Brain → Right Brain → Gemini planner pipeline, concurrency: 2
- [x] `app/api/mcp/left-brain/route.ts` — MCP proxy route for Left Brain (Code-Synapse)
- [x] `app/api/mcp/right-brain/route.ts` — MCP proxy route for Right Brain (Knowledge Extraction)
- [x] `app/api/projects/[id]/slices/[sliceId]/build/route.ts` — POST endpoint to trigger OpenHands build (auth, ownership, status update, payload dispatch, callback URL)
- [x] `env.mjs` — `OPENHANDS_API_URL`, `LEFT_BRAIN_MCP_URL`, `RIGHT_BRAIN_MCP_URL`, `DEMO_MODE`, `NEXT_PUBLIC_DEMO_MODE` all defined
- [x] `.env.example` — OpenHands, MCP, and Demo Mode sections added
- [x] `docker-compose.yml` — Containers renamed to `lazarus-*`, OpenHands service added (`ghcr.io/all-hands-ai/openhands:latest`), `openhands_workspace` volume added
- [x] `pnpm build` passes with all changes

**Implementation Notes:**
- Most of Phase 5.1 was implemented during Phase 2 (queue types, queues, workers, MCP proxy routes)
- Phase 5.2-5.4 are architectural specifications — the self-healing loop runs in the OpenHands agent's system prompt, not in Next.js code
- Phase 5.5 (Docker Compose) is the primary new implementation in this phase
- The slice build route dispatches to `OPENHANDS_API_URL/build` with contracts, callback URL, max retries (5), and confidence threshold (0.85)

---

<a id="phase-5-upgrade"></a>
## PHASE 5 UPGRADE: Demo-Worthy Build Experience

### Problem Statement

Phase 5 (OpenHands SDK Integration) is functionally complete, but the build experience — what users see when OpenHands builds a slice — is just the existing Glass Brain event stream. Non-technical viewers see scrolling events but can't follow the narrative. Technical viewers don't see the MCP protocol depth or architecture. Nobody sees the business value story.

### Goal

Transform the build experience into a narrative-driven showpiece where anyone instantly sees: WHERE we are in the build process, WHAT the agent is doing and WHY, HOW the Two Brains architecture works, and WHAT the business value is.

### 5U.0 Implementation Details

**Completed Tasks:**
- [x] **5U.1 Build Phase Derivation:** `derive-build-phase.ts` — Pure utility with types + derivation functions
- [x] **5U.2 CSS Animations:** Added `particle-flow` keyframes + `glow-red` utilities to `tailwind.css`
- [x] **5U.3 Build Phase Indicator:** `build-phase-indicator.tsx` — Phase pill badges
- [x] **5U.4 Cost Ticker:** `cost-ticker.tsx` — Traditional vs Lazarus cost comparison
- [x] **5U.5 Agent Brain Viz:** `agent-brain-viz.tsx` — Animated architecture diagram
- [x] **5U.6 Build Pipeline Tracker:** `build-pipeline-tracker.tsx` — 7-step horizontal stepper
- [x] **5U.7 Build Narrative Bar:** `build-narrative-bar.tsx` — Plain English narration
- [x] **5U.8 Self-Heal Arc:** `self-heal-arc.tsx` — 3-card dramatic story arc
- [x] **5U.9 MCP Tool Inspector:** `mcp-tool-inspector.tsx` — Slide-over tool call panel
- [x] **5U.10 Chaos Button:** `chaos-button.tsx` — Mock failure injection for demos
- [x] **5U.11 Header Stats Update:** Added brain viz, phase indicator, MCP toggle
- [x] **5U.12 Work Pane Update:** Added SelfHealArc overlay integration
- [x] **5U.13 Dashboard Wiring:** Connected all 9 new components with derivation useMemos

---

### 5U.1 Build Phase Derivation (Foundation)

**File: `components/ai/glass-brain/derive-build-phase.ts`** (NEW)

Pure utility module (no React, no "use client"). Foundation for all new components.

**Types:**
- `BuildPipelineStep` — 7 steps: contracts, test_gen, implement, unit_test, e2e_test, visual_check, ship_ready
- `BuildPhase` — 5 phases: analysis, generation, testing, healing, complete
- `StepStatus` — pending, active, complete, failed
- `ActiveBrain` — left, right, agent, idle
- `SelfHealCycle` — groups a failure → diagnosis → resolution sequence with retry tracking
- `MCPToolCall` — parsed tool call with source brain identification

**Exports:**
- `deriveBuildStep(events)` — Walks events, maps event types to pipeline steps, returns current step + all step statuses
- `deriveBuildPhase(events, confidence)` — High-level phase from event stream (last event type + confidence threshold)
- `deriveActiveBrain(events)` — Checks latest tool_call metadata for brain identifiers (code_synapse → left, knowledge → right)
- `groupSelfHealCycles(events)` — Groups test_fail → self_heal → code_write → test_pass into structured cycles
- `extractMCPToolCalls(events)` — Filters tool_call events, extracts tool name + source brain + duration + status
- `estimateCost(events)` — Traditional: LOC x $3.75 (min $500); Lazarus: events.length x $0.001; savingsPercent

**Step derivation logic:**
- `tool_call` → "contracts" active
- `code_write` with test-related filename → "test_gen" active
- `code_write` (plain) → "implement" active
- `test_run` → "unit_test" or "e2e_test" (from metadata.type)
- `self_heal` → reset failed step back to active
- confidence >= 0.85 → "ship_ready" complete

---

### 5U.2 CSS Animations

**File: `styles/tailwind.css`** (MODIFY)

**Added to `@theme` block:**
- `particle-flow` keyframes — translateX(0) → translateX(var(--flow-distance)) with opacity fade in/out
- `--animate-particle-flow` — 1.5s linear infinite

**Added to `@layer utilities`:**
- `.glow-red` — `box-shadow: 0 0 20px rgba(255, 51, 102, 0.2)` for error/self-heal states
- `.glow-red-strong` — `box-shadow: 0 0 40px rgba(255, 51, 102, 0.3)` for emphasized error states

---

### 5U.3 Build Phase Indicator

**File: `components/ai/glass-brain/build-phase-indicator.tsx`** (NEW)

**Props:** `currentPhase: BuildPhase`

5 pill badges in a horizontal row: Analysis (Microscope), Generation (Code), Testing (FlaskConical), Healing (RotateCw), Complete (CheckCircle).

**Styling:**
- Active: `bg-electric-cyan/20 text-electric-cyan border-electric-cyan/30` + subtle pulse animation
- Healing active: `text-rail-purple` with purple border/bg
- Complete: `bg-success/15 text-success`
- Upcoming: `border-border text-muted-foreground/40`
- Uses `AnimatePresence` with `layoutId` for smooth transitions

---

### 5U.4 Cost Ticker

**File: `components/ai/glass-brain/cost-ticker.tsx`** (NEW)

**Props:** `events: AgentEvent[]`

Compact inline display showing the cost comparison story using `estimateCost()` from derive-build-phase.

- Three values: "Traditional: $4,200" (strikethrough, muted) | "Lazarus: $0.47" (electric-cyan, ticking) | "Savings: 99.99%" (success, glowing)
- Traditional: `LOC x $3.75`, minimum $500
- Lazarus: `events.length x $0.001`, increments with each new event
- Savings: animated percentage with `animate-pulse-glow` when > 90%
- All numbers use `font-mono text-xs` with `AnimatedCost` component (rAF-based animation)
- Dollar formatting via `Intl.NumberFormat`

---

### 5U.5 Agent Brain Visualization

**File: `components/ai/glass-brain/agent-brain-viz.tsx`** (NEW)

**Props:** `activeBrain: ActiveBrain`

Compact animated mini diagram (fits in ~32px node height, ~200px width).

Three circular nodes: `[Left Brain] ---- [Agent Core] ---- [Right Brain]`

- Nodes: 32px rounded-full with glass-panel, icons Brain / Cpu / Eye
- Labels: text-[9px] font-grotesk below, showing active brain name
- Connecting lines: thin dashed border-electric-cyan with animated particle dots
- **Active state:** Active node scales to 1.1 + glow-cyan, others fade to opacity 0.3
- **Idle state:** All nodes opacity 0.3 with subtle breathing
- Wrapped in `TooltipProvider` — hovering shows full brain description

---

### 5U.6 Build Pipeline Tracker

**File: `components/ai/glass-brain/build-pipeline-tracker.tsx`** (NEW)

**Props:** `stepStatuses: Record<BuildPipelineStep, StepStatus>`, `currentStep: BuildPipelineStep`

7 steps with icons, labels, and animated connectors.

**Steps:** Contracts (FileText) → Test Gen (TestTube2) → Implement (Code) → Unit Test (FlaskConical) → E2E Test (MonitorPlay) → Visual (Eye) → Ship Ready (Rocket)

**Step rendering:**
- Pending: muted, opacity-50
- Active: electric-cyan + animated glow ring (`boxShadow` animation)
- Complete: success with CheckCircle overlay
- Failed: error with XCircle overlay

**Connectors:**
- Complete: solid success line
- Active: animated particle dot flowing left-to-right
- Pending: dashed muted line

---

### 5U.7 Build Narrative Bar

**File: `components/ai/glass-brain/build-narrative-bar.tsx`** (NEW)

**Props:** `events: AgentEvent[]`, `currentPhase: BuildPhase`

Thin bar (h-8) narrating what's happening for non-technical viewers.

- One sentence at a time with `AnimatePresence mode="wait"` crossfade
- Derives narrative from latest event type:
  - `thought` → use content directly (truncated to 120 chars)
  - `code_write` → "Writing implementation code in {filename}..."
  - `tool_call` → "Using {toolName} to gather context and requirements..."
  - `test_run` → "Running the test suite to verify the implementation..."
  - `test_result` pass → "All tests passing! Calculating confidence..."
  - `test_result` fail → "Tests failed — the agent is analyzing what went wrong..."
  - `self_heal` → "Detected an issue — diagnosing root cause and preparing a fix..."
- Prefix: Sparkles icon in electric-cyan

---

### 5U.8 Self-Heal Arc (THE Money Shot)

**File: `components/ai/glass-brain/self-heal-arc.tsx`** (NEW)

**Props:** `cycle: SelfHealCycle`, `onDismiss?: () => void`

Three-card dramatic story arc rendered when a self-heal cycle is active.

**Layout:** `grid grid-cols-3 gap-4`

**Failure Card (left):**
- Red-tinted glass: `rgba(255,51,102,0.08)`, `border-error/30`, `glow-red`
- XCircle icon, "Failure Detected" heading
- Error content from cycle.failureEvent
- Spring entrance at 0ms delay

**Diagnosis Card (center):**
- Purple-tinted glass: `rgba(110,24,179,0.08)`, `border-rail-purple/30`
- Brain icon, "Root Cause Analysis" heading
- Shows diagnosis content or pulsing dots placeholder
- Spring entrance at 800ms delay

**Resolution Card (right):**
- Green-tinted glass: `rgba(0,255,136,0.08)`, `border-success/30`, `glow-success`
- CheckCircle icon, "Fix Applied" heading
- Shows resolution content or pulsing dots placeholder
- Spring entrance at 1600ms delay

**Connecting particles:** Small dots flowing along a horizontal line between cards. Color transitions red → purple → green.

**Retry indicator:** "Self-Heal Attempt {N}/{max}" with progress dots at bottom.

**Dismissal:** Auto-dismiss 3s after resolution arrives or via click.

---

### 5U.9 MCP Tool Inspector

**File: `components/ai/glass-brain/mcp-tool-inspector.tsx`** (NEW)

**Props:** `toolCalls: MCPToolCall[]`, `isOpen: boolean`, `onClose: () => void`

Uses existing `Sheet` component (`@/components/ui/sheet`) with `side="right"`.

**Header:** "MCP Tool Inspector" + total calls count + success rate % badge

**Body:** Reverse-chronological tool call cards in `ScrollArea`:
- Left border color: cyan (Left Brain), purple (Right Brain), muted (Built-in)
- Tool name in `font-mono text-xs font-semibold`
- Source badge: "Left Brain" / "Right Brain" / "Built-in"
- Duration in mono font, status icon (CheckCircle green / XCircle red / pulsing dot)
- Click to expand: shows input/output in `<pre>` blocks from event metadata
- Uses array state for expanded IDs (avoids Map iteration issues per Build Gotchas)

---

### 5U.10 Chaos Button

**File: `components/ai/glass-brain/chaos-button.tsx`** (NEW)

**Props:** `projectId: string`, `sliceId?: string | null`

Floating button: `fixed bottom-6 right-6 z-40`

- Glass styling: `glass-card border-warning/20 bg-warning/5` with Zap icon
- Label: "Chaos" in small grotesk uppercase
- Hover: shake animation via `whileHover`
- Click: opens `AlertDialog` confirmation ("Inject Chaos?" / "Simulate a bug for the agent to self-heal")
- On confirm: POSTs 4 staggered mock events to `/api/projects/${projectId}/events`:
  1. `test_result` fail with `confidence_delta: -0.05` (0ms)
  2. `self_heal` diagnosis with `confidence_delta: -0.02` (800ms)
  3. `code_write` fix (1600ms)
  4. `test_result` pass with `confidence_delta: +0.08` (2400ms)
- Loading state while injecting

---

### 5U.11 Header Stats Update

**File: `components/ai/glass-brain/header-stats.tsx`** (MODIFY)

**New props added:**
- `currentPhase?: BuildPhase`
- `activeBrain?: ActiveBrain`
- `mcpCallCount?: number`
- `onToggleMCPInspector?: () => void`

**Changes:**
- Left section: Added `<AgentBrainViz>` before the status pulse dot
- Center section: Added `<BuildPhaseIndicator>` before live counters with a separator
- Right section: Added MCP toggle button (Wrench icon with call count Badge) before mute button

---

### 5U.12 Work Pane Update

**File: `components/ai/glass-brain/work-pane-enhanced.tsx`** (MODIFY)

**New prop:** `activeSelfHealCycle?: SelfHealCycle | null`

When `activeSelfHealCycle?.isActive`, renders `<SelfHealArc>` as an AnimatePresence overlay at the top of the work pane (above the event stream, below the header) with purple-tinted background:
```tsx
<motion.div className="border-b border-rail-purple/20 bg-rail-purple/5 p-3">
  <SelfHealArc cycle={activeSelfHealCycle} />
</motion.div>
```

---

### 5U.13 Dashboard Wiring

**File: `components/ai/glass-brain/glass-brain-dashboard.tsx`** (MODIFY)

**New imports:** All 9 new components + all derivation functions from `derive-build-phase.ts`

**New state:** `mcpInspectorOpen: boolean`

**New derived values (useMemo):**
- `{ step: currentStep, stepStatuses }` from `deriveBuildStep(events)`
- `currentPhase` from `deriveBuildPhase(events, confidence)`
- `activeBrain` from `deriveActiveBrain(events)`
- `selfHealCycles` from `groupSelfHealCycles(events)`
- `activeSelfHealCycle` from `selfHealCycles.find(c => c.isActive) ?? null`
- `mcpToolCalls` from `extractMCPToolCalls(events)`

**Updated healSpotlight:** Now driven by `activeSelfHealCycle?.isActive` + legacy timer for pane dimming

**Updated layout render order:**
1. `<BootSequence>` (AnimatePresence, unchanged)
2. `<HeaderStats>` — with new props (currentPhase, activeBrain, mcpCallCount, onToggleMCPInspector)
3. **NEW:** `<BuildNarrativeBar>` — events, currentPhase
4. **NEW:** `<BuildPipelineTracker>` — stepStatuses, currentStep
5. Three-pane grid (unchanged structure, WorkPane gets `activeSelfHealCycle` prop)
6. `<ActivityTimeline>` (unchanged)
7. **MODIFIED:** Confidence + Cost row — `<ConfidenceGauge>` (flex-1) + `<CostTicker>` side-by-side
8. **NEW:** `<ChaosButton>` — floating, projectId, sliceId
9. **NEW:** `<MCPToolInspector>` — slide-over, toolCalls, isOpen, onClose
10. `<VictoryLap>` (AnimatePresence, unchanged)

---

### Updated Dashboard Layout

```
+------------------------------------------------------------------+
| [BrainViz ○-○-○] [StatusPulse] [PhaseIndicator] [Stats Counters] |
|                     [Project/Slice] [Timer] [MCP] [Mute]         |
+------------------------------------------------------------------+
| [✦] "The agent is analyzing the behavioral contract..."          |
+------------------------------------------------------------------+
| ○ Contracts → ○ TestGen → ● Implement → ○ UnitTest → ○ Ship     |
+------------------------------------------------------------------+
|  Plan Pane    |    Work Pane                     |  Thoughts Pane |
|  [1fr]        |    [2fr]                         |  [1fr]         |
|               |  ┌─ SelfHealArc (when active) ─┐ |                |
|               |  │ [FAIL] → [DIAG] → [FIX]     │ |                |
|               |  └─────────────────────────────┘ |                |
+------------------------------------------------------------------+
| [Activity Timeline ||||||||||||||||||||||||||||||||]              |
+------------------------------------------------------------------+
| [Confidence Gauge ============ 67%]  | [Trad: $4.2k | AI: $0.47]|
+------------------------------------------------------------------+
                                              [⚡ Chaos] (floating)
                               [MCP Inspector] (slide-over from right)
                                 [Victory Lap] (fullscreen overlay)
```

---

### Phase 5 Upgrade Verification Checklist

**Status: ✅ COMPLETE**

- [x] `components/ai/glass-brain/derive-build-phase.ts` — Types + 6 derivation functions (deriveBuildStep, deriveBuildPhase, deriveActiveBrain, groupSelfHealCycles, extractMCPToolCalls, estimateCost)
- [x] `styles/tailwind.css` — particle-flow keyframes + glow-red/glow-red-strong utilities
- [x] `components/ai/glass-brain/build-phase-indicator.tsx` — 5 phase pill badges with active/complete/upcoming styling
- [x] `components/ai/glass-brain/cost-ticker.tsx` — Traditional vs Lazarus cost with animated counters and savings %
- [x] `components/ai/glass-brain/agent-brain-viz.tsx` — 3-node animated brain diagram with particle connections and tooltips
- [x] `components/ai/glass-brain/build-pipeline-tracker.tsx` — 7-step horizontal stepper with animated connectors
- [x] `components/ai/glass-brain/build-narrative-bar.tsx` — Plain English event narration with AnimatePresence crossfade
- [x] `components/ai/glass-brain/self-heal-arc.tsx` — 3-card dramatic story arc (Failure → Diagnosis → Resolution) with flowing particles and auto-dismiss
- [x] `components/ai/glass-brain/mcp-tool-inspector.tsx` — Sheet slide-over with tool call cards, source brain badges, expandable detail
- [x] `components/ai/glass-brain/chaos-button.tsx` — AlertDialog-guarded floating button, 4 staggered mock events for self-heal demo
- [x] `components/ai/glass-brain/header-stats.tsx` — Added AgentBrainViz, BuildPhaseIndicator, MCP toggle with count badge
- [x] `components/ai/glass-brain/work-pane-enhanced.tsx` — Added activeSelfHealCycle prop with SelfHealArc overlay
- [x] `components/ai/glass-brain/glass-brain-dashboard.tsx` — Wired all components with useMemo derivations, new layout with narrative bar + pipeline + cost ticker row
- [x] `pnpm build` passes with all changes (strict TS, noUncheckedIndexedAccess)

**Implementation Notes:**
- No new npm dependencies required — all components use existing framer-motion, lucide-react, shadcn/ui
- All array access guarded with `?.` for noUncheckedIndexedAccess compliance
- Uses `ease: "easeOut" as const` pattern for framer-motion variants
- Uses array state (not Map) for MCP inspector expanded IDs to avoid Map iteration issues
- `prefers-reduced-motion` disables particle animations (inherited from existing reduced-motion CSS rule)

---

<a id="phase-5b"></a>
## PHASE 5B: Autonomous Browser Testing & Live View

### Problem Statement

Phase 5 (OpenHands + Docker) and Phase 5 Upgrade (Demo-Worthy Build Experience) are complete. The agent can write code, run tests, and self-heal — but **it never opens a browser to visually verify what it built**. For demos, this is the biggest missing wow-factor: viewers want to **see** the agent click buttons, fill forms, log in with test credentials, and visually confirm each slice works.

### Goal

Add 3 new event types (`browser_action`, `screenshot`, `app_start`), a noVNC Docker service for live browser streaming, a browser stream panel in the Work Pane (tabbed), a screenshot gallery, and test credential seeding — so demos show the agent **visually testing** what it built.

### 5B.0 Implementation Details

**Completed Tasks:**
- [x] **5B.1 AgentEventType Extension:** Added `browser_action`, `screenshot`, `app_start` to type union
- [x] **5B.2 Events API Update:** Added 3 new types to Zod enum validation
- [x] **5B.3 SQL Migration:** CHECK constraint updated for new event types
- [x] **5B.4 Docker Compose:** Added `lazarus-novnc` service (port 6080)
- [x] **5B.5 Environment Variables:** `NOVNC_URL` (server) + `NEXT_PUBLIC_NOVNC_URL` (client)
- [x] **5B.6 Test User Seeding:** `seed-test-user.ts` utility + `/api/testing/seed` route
- [x] **5B.7 derive-stats.ts:** EVENT_COLORS + status labels for 3 new types
- [x] **5B.8 derive-build-phase.ts:** Browser event → `visual_check` step, phase + brain derivation
- [x] **5B.9 build-narrative-bar.tsx:** Narrative text for browser_action, screenshot, app_start
- [x] **5B.10 work-pane.tsx + work-pane-enhanced.tsx:** EVENT_CONFIG entries for new types
- [x] **5B.11 Browser Stream Panel:** noVNC iframe wrapper with connection status + fullscreen
- [x] **5B.12 Screenshot Gallery:** Lightbox gallery with grid thumbnails + Dialog viewer
- [x] **5B.13 Work Pane Tabs:** Events | Browser | Screenshots tabs with auto-switching
- [x] **5B.14 Dashboard Wiring:** `novncUrl` + `screenshots` passed to WorkPaneEnhanced
- [x] **5B.15 Sound Effects:** New event types mapped to existing sounds in `use-agent-events.ts`

---

### 5B.1 AgentEventType Extension

**File: `lib/db/types.ts`** (MODIFY)

**Task:** Add 3 new event types to the `AgentEventType` union.

**Change:**
```typescript
export type AgentEventType = '...' | 'browser_action' | 'screenshot' | 'app_start'
```

**New event type semantics:**
- `browser_action`: Agent performed a browser action (click, type, navigate). `metadata: { action: "click" | "type" | "navigate" | "scroll", target?: string, value?: string, url?: string }`
- `screenshot`: Agent captured a screenshot. `metadata: { url: string, step?: string, thumbnail_url?: string }`
- `app_start`: Agent started the application under test. `metadata: { url: string, port?: number, command?: string }`

---

### 5B.2 Events API Update

**File: `app/api/projects/[id]/events/route.ts`** (MODIFY)

**Task:** Add 3 new values to the `event_type` z.enum so the POST callback accepts browser testing events.

---

### 5B.3 SQL Migration

**File: `supabase/migrations/20260208020000_add_browser_event_types.sql`** (NEW)

**Task:** Update the CHECK constraint on `agent_events.event_type` to include the 3 new types.

```sql
ALTER TABLE agent_events DROP CONSTRAINT IF EXISTS agent_events_event_type_check;
ALTER TABLE agent_events ADD CONSTRAINT agent_events_event_type_check
  CHECK (event_type IN (
    'thought', 'tool_call', 'observation', 'code_write',
    'test_run', 'test_result', 'self_heal', 'confidence_update',
    'browser_action', 'screenshot', 'app_start'
  ));
```

---

### 5B.4 Docker Compose — noVNC Service

**File: `docker-compose.yml`** (MODIFY)

**Task:** Add noVNC browser streaming service.

```yaml
novnc:
  image: theasp/novnc:latest
  container_name: lazarus-novnc
  ports:
    - "6080:8080"
  environment:
    - DISPLAY_WIDTH=1280
    - DISPLAY_HEIGHT=720
    - RUN_XTERM=no
  depends_on:
    - openhands
  restart: unless-stopped
```

No new named volumes needed — noVNC is stateless.

---

### 5B.5 Environment Variables

**File: `env.mjs`** (MODIFY)

**Added to `server` block:**
- `NOVNC_URL: z.string().url().optional()`

**Added to `client` block:**
- `NEXT_PUBLIC_NOVNC_URL: z.string().url().optional()`

**Added to `runtimeEnv`:**
- `NOVNC_URL: process.env.NOVNC_URL`
- `NEXT_PUBLIC_NOVNC_URL: process.env.NEXT_PUBLIC_NOVNC_URL`

**File: `.env.example`** (MODIFY)

New section added before "Demo Mode":
```env
# noVNC Browser Stream (Optional - for live view)
NOVNC_URL=http://localhost:6080
NEXT_PUBLIC_NOVNC_URL=http://localhost:6080
```

---

### 5B.6 Test User Seeding

**File: `lib/testing/seed-test-user.ts`** (NEW — ~30 lines)

**Task:** Utility to check if the test user exists via Supabase, with constants for test credentials.

**Exports:**
- `TEST_USER` — `{ email: "test@lazarus.dev", password: "TestPass123!", name: "Lazarus Test User" }`
- `seedTestUser()` — Checks `user` table for existing test user; returns `{ success, userId? }`

Uses `(supabase as any).from("user")` pattern for Supabase queries.

**File: `app/api/testing/seed/route.ts`** (NEW — ~35 lines)

**Task:** POST endpoint to create the test user via Better Auth's `signUpEmail` API.

**Key behavior:**
- Guard: returns 403 in production unless `DEMO_MODE` is enabled
- Calls `auth.api.signUpEmail({ body: { email, password, name } })`
- If user already exists (error contains "already exists" or "duplicate"), returns `{ ok: true }` gracefully
- Uses structured logging via `logger`

---

### 5B.7 derive-stats.ts — Colors + Labels

**File: `components/ai/glass-brain/derive-stats.ts`** (MODIFY)

**Added to `EVENT_COLORS` record:**
```typescript
browser_action: "#FF9500",  // orange
screenshot: "#AF52DE",      // violet
app_start: "#30D158",       // green
```

**Added to `getAgentStatusLabel()` switch:**
```typescript
case "browser_action": → "Browser: {action}..."
case "screenshot":     → "Capturing screenshot..."
case "app_start":      → "Starting application..."
```

---

### 5B.8 derive-build-phase.ts — Browser Event Handling

**File: `components/ai/glass-brain/derive-build-phase.ts`** (MODIFY)

**`deriveBuildStep()` additions:**
- `app_start` → marks `implement` and `unit_test` as complete (moving to visual verification phase)
- `browser_action` → activates `visual_check` step, sets current step
- `screenshot` → keeps `visual_check` active if not already

**`deriveBuildPhase()` additions:**
- `browser_action` or `screenshot` → returns `"testing"` phase
- `app_start` → returns `"generation"` phase

**`deriveActiveBrain()` additions:**
- `browser_action` or `app_start` → returns `"agent"` brain (these come from the agent core)

---

### 5B.9 build-narrative-bar.tsx — Browser Narratives

**File: `components/ai/glass-brain/build-narrative-bar.tsx`** (MODIFY)

**Added narrative cases:**
```typescript
case "browser_action": → "The agent is {action} {target} in the browser..."
case "screenshot":     → "Captured a screenshot to verify the visual output..."
case "app_start":      → "Starting {url} for live browser testing..."
```

---

### 5B.10 EVENT_CONFIG Updates

**File: `components/ai/glass-brain/work-pane.tsx`** (MODIFY)
**File: `components/ai/glass-brain/work-pane-enhanced.tsx`** (MODIFY)

**Task:** Both files have a `Record<AgentEventType, ...>` for EVENT_CONFIG. Added 3 new entries to each:

```typescript
browser_action: { icon: Globe, colorClass: "text-warning", label: "Browser" },
screenshot: { icon: Camera, colorClass: "text-rail-purple", label: "Screenshot" },
app_start: { icon: Play, colorClass: "text-success", label: "App Start" },
```

Imported `Globe`, `Camera` from lucide-react (both files).

---

### 5B.11 Browser Stream Panel

**File: `components/ai/glass-brain/browser-stream-panel.tsx`** (NEW — ~130 lines)

**Props:** `novncUrl: string | null`, `isActive: boolean`

**Task:** noVNC iframe wrapper with connection status, loading overlay, and fullscreen toggle.

**Rendering states:**
1. **No URL configured:** Placeholder with Monitor icon — "Browser stream not configured" + "Set NEXT_PUBLIC_NOVNC_URL to enable live browser view"
2. **URL configured, not active:** Pulsing Monitor icon — "Waiting for browser session..."
3. **Active:** `<iframe>` with `src={novncUrl}/vnc.html?autoconnect=true&resize=scale`:
   - Connection status bar: green dot (connected) / yellow pulsing (connecting) / red (disconnected)
   - Fullscreen button (`Maximize2` icon) using `requestFullscreen()` on container
   - Loading spinner overlay that fades out on iframe `onLoad`
   - Wifi/WifiOff status icon

---

### 5B.12 Screenshot Gallery

**File: `components/ai/glass-brain/screenshot-gallery.tsx`** (NEW — ~160 lines)

**Props:** `screenshots: AgentEvent[]` (filtered screenshot events)

**Task:** Lightbox gallery of screenshots captured during browser testing.

**Rendering:**
- **Grid layout:** `grid grid-cols-3 gap-2` for thumbnails
- **Each thumbnail:**
  - `metadata.thumbnail_url` or `metadata.url` as image source
  - Hover scale effect, rounded corners, border
  - Caption: truncated content + `timeAgo()` timestamp
  - Staggered entrance animation (50ms per card)
- **Lightbox:** Uses `Dialog` / `DialogContent` from `@/components/ui/dialog`
  - Full-size image from `metadata.url`
  - Prev/Next navigation (ChevronLeft/ChevronRight)
  - Step label from `metadata.step`
  - Accessible DialogTitle (sr-only)
- **Empty state:** Camera icon + "No screenshots yet"
- **Max display:** Latest 12, with count indicator when more exist

---

### 5B.13 Work Pane Tabs

**File: `components/ai/glass-brain/work-pane-enhanced.tsx`** (MODIFY — major update)

**New imports:** `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`, `BrowserStreamPanel`, `ScreenshotGallery`, `Camera, Globe, List` from lucide-react.

**New props:**
```typescript
novncUrl?: string | null
screenshots?: AgentEvent[]
```

**New state:** `activeTab: string` (controlled tabs)

**Auto-tab switching:** `useEffect` watches `events` — auto-switches to "browser" tab on `app_start`/`browser_action` events, and to "screenshots" tab on `screenshot` events.

**Updated layout:**
```
+---------------------------------------------+
| The Work                      12 events      |
+---------------------------------------------+
| [Events]  [Browser]  [Screenshots (3)]       |
+---------------------------------------------+
| (Events tab - existing event stream)         |
| OR                                           |
| (Browser tab - noVNC iframe live stream)     |
| OR                                           |
| (Screenshots tab - gallery grid)             |
+---------------------------------------------+
|                    [↓ Latest]                 |
+---------------------------------------------+
```

- Events tab: contains the existing event stream with auto-scroll + "Jump to Latest" FAB
- Browser tab: `<BrowserStreamPanel novncUrl={novncUrl} isActive={events.length > 0} />`
- Screenshots tab: `<ScreenshotGallery screenshots={screenshots ?? []} />` — only shown when `screenshots.length > 0`
- TabsList styled: `bg-void-black/50 border border-border h-8`, triggers with `text-xs gap-1` and icons

---

### 5B.14 Dashboard Wiring

**File: `components/ai/glass-brain/glass-brain-dashboard.tsx`** (MODIFY)

**New derived values:**
```typescript
const novncUrl = process.env.NEXT_PUBLIC_NOVNC_URL ?? null

const screenshots = useMemo(
  () => events.filter((e) => e.event_type === "screenshot"),
  [events]
)
```

**Updated WorkPaneEnhanced render:**
```tsx
<WorkPaneEnhanced
  events={events}
  slices={slices}
  activeSelfHealCycle={activeSelfHealCycle}
  novncUrl={novncUrl}
  screenshots={screenshots}
/>
```

---

### 5B.15 Sound Effects

**File: `hooks/use-agent-events.ts`** (MODIFY)

**Added to `playSoundForEvent()` switch:**
```typescript
case "browser_action": sounds.playKeystroke()       // reuse keystroke for browser clicks
case "screenshot":     sounds.playSuccess()          // reuse success for captures
case "app_start":      sounds.playConfidenceTick()   // reuse tick for app startup
```

---

### Updated Work Pane Layout (Tabbed)

```
+---------------------------------------------+
| The Work                      12 events      |
+---------------------------------------------+
| [Events]  [Browser]  [Screenshots (3)]       |
+---------------------------------------------+
| (Events tab - existing event stream)         |
| OR                                           |
| (Browser tab - noVNC iframe live stream)     |
|  ┌─────────────────────────────────────────┐ |
|  │                                         │ |
|  │         noVNC Live Stream               │ |
|  │         (agent's browser)               │ |
|  │                                         │ |
|  └─────────────────────────────────────────┘ |
| OR                                           |
| (Screenshots tab - gallery grid)             |
|  ┌──────┐ ┌──────┐ ┌──────┐                 |
|  │ img  │ │ img  │ │ img  │  click to expand |
|  │  1   │ │  2   │ │  3   │  in lightbox     |
|  └──────┘ └──────┘ └──────┘                 |
+---------------------------------------------+
|                    [↓ Latest]                 |
+---------------------------------------------+
```

---

### Phase 5B Verification Checklist

**Status: ✅ COMPLETE**

- [x] `lib/db/types.ts` — `AgentEventType` extended with `browser_action`, `screenshot`, `app_start`
- [x] `app/api/projects/[id]/events/route.ts` — Zod enum updated with 3 new types
- [x] `supabase/migrations/20260208020000_add_browser_event_types.sql` — CHECK constraint updated
- [x] `docker-compose.yml` — `lazarus-novnc` service added (theasp/novnc, port 6080, depends on openhands)
- [x] `env.mjs` — `NOVNC_URL` (server) + `NEXT_PUBLIC_NOVNC_URL` (client) added to schema + runtimeEnv
- [x] `.env.example` — noVNC URL section added
- [x] `lib/testing/seed-test-user.ts` — TEST_USER constants + seedTestUser() utility
- [x] `app/api/testing/seed/route.ts` — POST endpoint, 403 in prod unless DEMO_MODE, Better Auth signUpEmail
- [x] `components/ai/glass-brain/derive-stats.ts` — EVENT_COLORS + getAgentStatusLabel for 3 new types
- [x] `components/ai/glass-brain/derive-build-phase.ts` — browser_action → visual_check, app_start → generation phase, deriveActiveBrain handles browser events
- [x] `components/ai/glass-brain/build-narrative-bar.tsx` — 3 new narrative cases for browser events
- [x] `components/ai/glass-brain/work-pane.tsx` — EVENT_CONFIG entries for 3 new types (Globe, Camera, Play icons)
- [x] `components/ai/glass-brain/work-pane-enhanced.tsx` — EVENT_CONFIG entries + Tabs (Events | Browser | Screenshots) + auto-tab switching + BrowserStreamPanel + ScreenshotGallery integration
- [x] `components/ai/glass-brain/browser-stream-panel.tsx` — noVNC iframe wrapper with connection status, loading overlay, fullscreen toggle, 3 rendering states
- [x] `components/ai/glass-brain/screenshot-gallery.tsx` — Grid thumbnails, Dialog lightbox with prev/next navigation, empty state, max 12 display
- [x] `components/ai/glass-brain/glass-brain-dashboard.tsx` — novncUrl + screenshots derived and passed to WorkPaneEnhanced
- [x] `hooks/use-agent-events.ts` — Sound effects for browser_action (keystroke), screenshot (success), app_start (tick)
- [x] `pnpm build` passes with all changes (strict TS, noUncheckedIndexedAccess)

**Implementation Notes:**
- No new npm dependencies — noVNC is a Docker image, not an npm package
- All `event.metadata` access cast as `Record<string, unknown> | null` per project patterns
- Both `work-pane.tsx` (base) and `work-pane-enhanced.tsx` updated to avoid `Record<AgentEventType, ...>` build errors
- `useRef<T>(null)` pattern used in browser-stream-panel (not `useRef<T>()`)
- Tab auto-switching only triggers on latest event to avoid thrashing during initial load
- Screenshot gallery uses `<img>` tags with `eslint-disable @next/next/no-img-element` since URLs are dynamic agent-generated screenshots, not static assets

---

<a id="phase-6"></a>
## PHASE 6: Gemini Integration

### 6.0 Implementation Details

**Decoupled Architecture:** All Gemini API code lives in a single client (`lib/ai/gemini.ts`). No other file imports `@google/genai`. Consumers use `getGeminiClient()` which returns the `IGeminiClient` interface.

**SDK:** We use `@google/genai` (not `@google/generative-ai`). Structured outputs via `responseMimeType: "application/json"` + `responseJsonSchema` (from Zod `z.toJSONSchema()`).

**Reference:** [Google Gemini API](https://ai.google.dev/gemini-api/docs/gemini-3), [Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)

**Completed Tasks:**
- [x] **6.1 Gemini Client:** `lib/ai/gemini.ts` — `@google/genai`, lazy-init, `IGeminiClient`.
- [x] **6.2 Gemini Planner:** `lib/ai/gemini-planner.ts` — `generateStructured()` with `generatedSlicesArraySchema`.
- [x] **6.3 Thought Signatures:** `lib/ai/thought-signatures.ts` — `generateStructured()` with `thoughtSignatureSchema`.
- [x] **6.4 Confidence Explainer:** `lib/ai/confidence-explainer.ts` — `generateStructured()` with `confidenceExplanationSchema`.
- [x] **6.5 Gemini API Proxy Route:** `app/api/gemini/route.ts` — uses `generateText()`.
- [x] **6.6 Agent Runner:** `lib/ai/agent-runner.ts` — uses `generateText()`.

### 6.1 Gemini Client (Single Source of Truth)

**File: `lib/ai/gemini.ts`**

**Architecture:**
- **SDK:** `@google/genai` — only this file imports it.
- **Interface:** `IGeminiClient` — `generateText()` and `generateStructured(prompt, schema)`.
- **Structured outputs:** `responseMimeType: "application/json"` + `responseJsonSchema` (Zod `z.toJSONSchema()`).
- **Environment:** `GEMINI_API_KEY` (required), `GEMINI_MODEL` (optional, default `gemini-2.0-flash`).

**Interface:**
```typescript
interface IGeminiClient {
  generateText(prompt: string, options?: { systemInstruction?: string }): Promise<string>
  generateStructured<T>(prompt: string, schema: z.ZodType<T>, options?: { systemInstruction?: string }): Promise<T>
}
```

**Zod schemas:** `lib/ai/schemas.ts` — `generatedSlicesArraySchema`, `thoughtSignatureSchema`, `confidenceExplanationSchema`.

**Model options (per Gemini API docs):**
- `gemini-2.0-flash` — Default; fast, cost-effective.
- `gemini-3-pro-preview` — Latest reasoning (requires `@google/genai` SDK).
- Set via `GEMINI_MODEL` env var.

**Gemini 3:** Set `GEMINI_MODEL=gemini-3-flash-preview` or `gemini-3-pro-preview` for latest models. See [Gemini 3](https://ai.google.dev/gemini-api/docs/gemini-3).

**Enhancement — Gemini Context Caching:**
For repeated analysis of the same project, use Gemini's context caching feature. Before sending a planning request, check if a cached context exists for this project's code+behavioral analysis. Cache the project's full analysis as a "system instruction" context, then subsequent queries (thought signatures, confidence explanations) reuse it without re-sending the full analysis each time. This reduces latency and cost.

---

### 6.2 Gemini Planner

**File: `lib/ai/gemini-planner.ts`** (NEW)

**Task:** Migration planner that uses Gemini to decompose a legacy app into vertical slices.

> **Enhancement:** Use **LangGraph** to structure the planning process if the logic becomes complex (e.g., iterative refinement of the plan, critique loops). LangGraph nodes can represent "Draft Plan", "Critique Plan", "Refine Plan" steps.

**Input:** Project row from Supabase (contains code analysis in `metadata.code_analysis` and behavioral data in `metadata.behavioral_analysis`)

**Output:** Array of `GeneratedSlice` objects: `{ name, description, priority, behavioral_contract, code_contract, modernization_flags, dependencies }`

**Prompt structure:**
```
You are a software migration planner. Given:
- Code Analysis (Left Brain): {JSON}
- Behavioral Analysis (Right Brain): {JSON}

Decompose into vertical slices for migration to {targetFramework}.
Each slice: self-contained, independently buildable.
Order by dependency (foundational first).
Include behavioral contracts, code contracts, modernization flags.
Return JSON array only.
```

**Response:** Uses `client.generateStructured(prompt, generatedSlicesArraySchema)` — native structured output, no markdown stripping. On failure, returns empty array (gemini-planner) or safe default (thought-signatures).

---

### 6.3 Thought Signatures

**File: `lib/ai/thought-signatures.ts`** (NEW)

**Task:** Summarize batches of raw agent events into human-readable thought summaries for the Thoughts pane.

**Key behavior:**
- Called every 5-10 raw events
- Takes an array of AgentEvent objects
- Sends them to Gemini with a prompt asking for: summary (1-2 sentences), category (Planning/Implementing/Testing/Debugging/Healing), confidenceImpact (-0.2 to 0.2)
- Returns a `ThoughtSignature` object
- On failure: return a safe default

**Enhancement — Gemini TTS/Voice Output:**
For particularly dramatic moments (self-heal diagnosis, confidence reaching Ship Ready), use Gemini's TTS capabilities to generate a brief spoken summary. The voice output plays through the browser's audio — the AI literally "speaks" its diagnosis. This is an optional enhancement that can be toggled.

Implementation: Call Gemini with `generateContent` using the `response_modalities: ["AUDIO"]` config. Play the returned audio data via `AudioContext`.

---

### 6.4 Confidence Explainer

**File: `lib/ai/confidence-explainer.ts`** (NEW)

**Task:** Calculate confidence scores and generate human-readable explanations.

**Confidence formula:**
```
confidence = (unit_pass_rate × 0.15)
           + (e2e_pass_rate × 0.25)
           + (visual_match × 0.20)
           + (behavioral_match × 0.20)
           + (video_similarity × 0.20)
```

**Functions:**
- `calculateConfidence(results: TestResults) → number` — Pure math, no AI
- `explainConfidence(results: TestResults) → string` — Uses Gemini to generate a 2-3 sentence actionable explanation of what's working and what needs improvement

---

### 6.5 Gemini API Proxy Route

**File: `app/api/gemini/route.ts`** (NEW)

**Task:** Authenticated proxy to Gemini for client-side requests.

| Method | Auth | Body | Response |
|--------|------|------|----------|
| POST | Required | `{ prompt, context? }` | `{ text }` |

Concatenate context + prompt if both provided. Return Gemini's text response.

---

### 6.6 Update Agent Runner for Gemini

**File: `lib/ai/agent-runner.ts`** (MODIFY)

**Task:** Add Gemini as the default LLM, with OpenAI as fallback.

**Key changes:**
1. Add `useGemini` flag in constructor: `true` if `GEMINI_API_KEY` is set
2. `run()` method: dispatch to `runWithGemini()` or `runWithOpenAI()` based on flag
3. `runWithGemini()`: build prompt from system + messages, call `client.generateText(prompt)`, return as assistant message
4. `runWithOpenAI()`: keep existing implementation unchanged (OpenAI chat completions with tool calling)
5. Add `buildPromptString(state)` helper that concatenates system prompt and messages into a single string for Gemini

---

### Phase 6 Verification Checklist

**Status: ✅ COMPLETE**

- [x] `lib/ai/gemini.ts` — Lazy-init client, `IGeminiClient` interface, `generateText()` and `generateStructured()`
- [x] `lib/ai/gemini-planner.ts` — `generateStructured()` with `generatedSlicesArraySchema`
- [x] `lib/ai/thought-signatures.ts` — `generateStructured()` with `thoughtSignatureSchema`
- [x] `lib/ai/confidence-explainer.ts` — `generateStructured()` with `confidenceExplanationSchema`
- [x] `app/api/gemini/route.ts` — Authenticated proxy for client-side Gemini requests
- [x] `lib/ai/agent-runner.ts` — Uses Gemini when `GEMINI_API_KEY` is set, OpenAI fallback
- [x] `lib/ai/schemas.ts` — Zod schemas for structured outputs

---

<a id="phase-7"></a>
## PHASE 7: Testing Strategy

### 7.1 Generated Code Test Tiers

The OpenHands agent generates and runs tests autonomously with these tiers:

| Tier | Tool | Confidence Weight | Source of Truth |
|------|------|------------------|----------------|
| Unit Tests | Vitest | 15% | Code contracts (Left Brain) |
| E2E Tests | Playwright | 25% | Behavioral contracts (Right Brain) |
| Visual Tests | Playwright screenshots | 20% | Reference screenshots from video recordings |
| Behavioral Tests | Playwright replay | 20% | User flow recordings from Right Brain |
| Video Diff | Gemini Vision comparison | 20% | Original legacy app recordings |

### 7.2 Platform Tests (Our Own Code)

**Unit tests (Vitest):**
- Supabase client helpers (mock Supabase client)
- Gemini client wrapper (mock API)
- Confidence score calculation (pure function, no mocks needed)
- Event processing pipeline

**E2E tests (Playwright):**
- Upload flow: create project, upload files, trigger processing
- Glass Brain Dashboard: verify real-time updates render correctly
- Slice selection and build trigger
- Auth flows (existing tests should still pass after migration)

### 7.3 Data Fetching Hooks

**File: `hooks/use-project.ts`** (NEW)

**Task:** Client-side hook to fetch a single project by ID.

> **Implementation Note:** Use **React Query** (`@tanstack/react-query`) for robust data fetching, caching, and loading states instead of raw `useEffect`.

**Pseudo code (React Query):**
```typescript
import { useQuery } from '@tanstack/react-query'

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      return res.json()
    }
  })
}
```

**File: `hooks/use-slices.ts`** (NEW)

**Task:** Client-side hook to fetch slices for a project.

Same pattern as `useProject` but fetches from `/api/projects/{projectId}/slices` and returns an array. Use React Query's `useQuery` with key `['slices', projectId]`.

---

<a id="phase-8"></a>
## PHASE 8: Landing Page & Demo Mode

> **Reference:** See `docs/UI_UX_GUIDE.md` Part II (Design System) and Part V (Project Lazarus UI) for landing page aesthetics and component usage.

### 8.1 Update Root Layout Metadata

**File: `app/layout.tsx`** (MODIFY)

**Task:** Update the Next.js metadata to reflect Project Lazarus branding.

**Changes:**
- `title.default`: "Project Lazarus - Reincarnate Legacy Software"
- `title.template`: "%s | Project Lazarus"
- `description`: "Project Lazarus transmutes legacy software into modern web applications using AI agents with test-first development and self-healing loops."
- `keywords`: legacy migration, software modernization, AI agents, code generation, Next.js, automated testing

---

### 8.2 Landing Page Redesign

**File: `app/page.tsx`** (MODIFY — replace entire contents)

**Task:** Replace the generic boilerplate landing page with the Project Lazarus showcase.

> 💡 **Tip:** Refer to `docs/UI_UX_GUIDE.md` Section 5.11 for the "Legacy Crumble" animation spec.

**Sections:**

#### Header
- Logo badge + "Project Lazarus" text
- "Sign In" (ghost button) + "Get Started" (primary button)

#### Hero Section
- Headline in `font-grotesk`: "Reincarnate **Legacy Software**" (gradient text on "Legacy Software" using `bg-automation-flow bg-clip-text text-transparent`)
- Subtitle: Platform description in `text-muted-foreground`
- Two CTAs: "Begin Transmutation" (primary, rail-fade bg, Sparkles icon) + "Watch Demo" (outline, Play icon)
- Background: `bg-automation-flow` at 3% opacity with gradient overlays top/bottom

#### Features Section (Three Pillars)
Three cards in a `md:grid-cols-3` grid:

| Icon | Title | Description |
|------|-------|-------------|
| Brain | Two Brains | Code-Synapse (Left) analyzes codebase structure. Knowledge Extraction (Right) understands user behavior from videos and docs. |
| Code | Glass Brain Dashboard | Watch your AI agent think, code, and test in real-time. A 3-pane HUD shows the plan, the work, and the agent's reasoning. |
| TestTube | Self-Healing Tests | Tests are written first, then code to pass them. When tests fail, the agent diagnoses and self-heals until 85%+ confidence. |

Cards: `rounded-2xl border bg-card/50 p-8 hover:glow-purple` transition. Icons in `rail-fade/20` background circles.

#### CTA Section
- "Ready to Modernize?" headline
- "Get Started" button

#### Footer
- Copyright line: "Built for the hackathon"

**Enhancement — Legacy Crumble Hero Animation:**
In the hero section, add an animated visual showing the "transmutation" concept:
- Left side: a wireframe representation of an old-school app (grey, blocky) that slowly dissolves/crumbles into particles
- Right side: a modern, sleek app wireframe that assembles from those same particles
- The particles travel in a glowing arc from left to right
- Loop the animation every 8-10 seconds
- Implement with CSS `@keyframes` and `framer-motion` for the particle system
- This immediately communicates the product's value proposition visually

**Enhancement — Live Demo Preview:**
Below the hero, embed an auto-playing, looping preview of the Glass Brain Dashboard (either a recorded GIF/video or a simplified live mock using demo events at 5x speed). This gives visitors a taste of the experience before signing up.

---

### 8.3 Update Constants

**File: `lib/utils/constants.ts`** (MODIFY)

**Task:** Update app name and description constants.

```
APP_NAME = "Project Lazarus"
APP_DESCRIPTION = "Reincarnate Legacy Software - AI-powered autonomous code migration"
```

---

### 8.4 Demo Mode Mock Events

**File: `lib/demo/mock-events.ts`** (NEW)

**Task:** Create a pre-recorded sequence of agent events for reliable hackathon demos.

**Purpose:** When `DEMO_MODE=true`, the Glass Brain Dashboard plays back these mock events instead of waiting for a real OpenHands agent. This ensures demos are reliable, well-paced, and always showcase the self-healing loop.

**Event sequence (with timing):**

| Time | Event Type | Content Summary |
|------|-----------|----------------|
| 0s | thought | "Analyzing legacy Express + EJS todo application..." |
| 2s | tool_call | "code_synapse.parse_repo(github.com/demo/legacy-todo)" |
| 4s | observation | "Found 12 routes, 8 EJS templates, 3 middleware, jQuery UI components" |
| 5s | tool_call | "knowledge.extract_behaviors(2 video recordings)" |
| 8s | observation | "Extracted 5 user flows: create, complete, filter, drag reorder, bulk delete" |
| 10s | thought | "Decomposing into vertical slices..." (+5% confidence) |
| 15s | thought | "Starting Slice 1: Todo CRUD" |
| 17s | code_write | Writing Vitest unit tests (show test code) |
| 20s | code_write | Writing Playwright E2E test (show test code) |
| 23s | code_write | Implementing Todo component with RSC (show component code) |
| 26s | test_run | "Running unit tests..." |
| 28s | test_result (FAIL) | "2/3 passed, 1 failed — deleteTodo not a function" (-5% confidence) |
| 30s | self_heal | "Diagnosis: deleteTodo not exported. Missing from barrel export." (-2% confidence) |
| 32s | code_write | "Fixing export..." |
| 34s | test_run | "Re-running unit tests..." |
| 36s | test_result (PASS) | "3/3 passed" (+12% confidence) |
| 38s | test_run | "Running E2E tests..." |
| 42s | test_result (PARTIAL) | "4/5 passed, drag reorder not implemented" (+8% confidence) |
| 44s | tool_call | "knowledge.compare_screenshots" |
| 47s | observation | "Visual match: 82%" |
| 48s | thought | "Need to implement drag reorder" (+5% confidence) |
| 50s | code_write | "Adding drag-and-drop with @dnd-kit..." |
| 54s | test_run | "Re-running all tests..." |
| 58s | test_result (PASS) | "All 8 tests passing" (+15% confidence) |
| 60s | confidence_update | "Slice 1 confidence: 91% — Ship Ready!" (+6% confidence) |
| 61s | thought | "Slice 1 complete! Moving to Slice 2." |

**Implementation:**
- Export `DEMO_EVENTS` array of mock event objects with `delay` field (ms from start)
- Export `streamDemoEvents(speedMultiplier)` async generator that yields events with realistic timing
- Each yielded event matches the `agent_events` Row type with a generated UUID and current timestamp

**Enhancement — Spacebar Pause/Resume:**
In demo mode, add a global keyboard listener:
- **Spacebar**: Pause/resume the event stream
- **Right arrow**: Skip to next event immediately
- **Left arrow**: Go back one event (replay)
- **Number keys 1-5**: Set playback speed (1x, 2x, 3x, 4x, 5x)

This gives presenters precise control over pacing. Show a subtle "PAUSED" indicator in the header when paused.

**Enhancement — Time-Lapse / Montage Pacing:**
For the "boring" parts of the demo (initial analysis, standard code generation), use faster playback (2-3x). For the dramatic moments (test failure, self-heal diagnosis, confidence reaching Ship Ready), automatically slow to 0.5x or real-time. This creates cinematic pacing:
- Analysis phase: 2x speed
- First code generation: 1.5x speed
- Test failure: 0.75x speed (slow-mo for drama)
- Self-heal diagnosis: real-time (let it breathe)
- Fix + re-test: 1.5x speed
- Ship Ready moment: 0.5x speed (let it land)

Implement by having the demo events include a `playbackSpeed` field that the stream generator respects.

**Enhancement — Pre-staged Demo Project:**
For reliability, pre-stage a demo project:
- Small legacy Express + EJS todo app on a public GitHub repo
- 2-3 short video clips of the app being used
- Pre-parse with Code-Synapse so processing appears near-instant
- Pre-generate vertical slices so the plan view is immediately available

---

### 8.5 Demo Mode Integration

**Task:** Wire demo mode throughout the application.

**In `hooks/use-agent-events.ts`:**
- Check `process.env.NEXT_PUBLIC_DEMO_MODE === "true"` (or read from a context)
- If demo mode: instead of subscribing to Supabase Realtime, consume `streamDemoEvents()` generator
- Apply spacebar pause/resume listener

**In `app/(dashboard)/projects/[id]/page.tsx`:**
- If demo mode: use pre-loaded mock project and slices instead of Supabase queries

**In `env.mjs`:**
- Add `NEXT_PUBLIC_DEMO_MODE` to client schema (so it's available in browser)

---

### 8.6 Victory Lap Features

These are polish features for after a slice completes:

#### Victory Lap QR Code
**File: `components/ai/glass-brain/victory-lap.tsx`** (NEW)

**Task:** When a slice reaches "Ship Ready" (confidence >= 85%):
1. Full-screen celebratory overlay for 3-5 seconds
2. Show the confidence score in massive font with glow animation
3. Display a QR code linking to the live deployed preview of the generated app
4. Confetti or particle burst animation
5. "TRANSMUTATION COMPLETE" text in `font-grotesk`
6. Auto-dismiss after 5 seconds or on click

#### MCP Client Tab
**Enhancement:** Add a fourth collapsible pane (or overlay tab) to the Glass Brain Dashboard that shows raw MCP tool calls and responses. This is like a "developer tools" view that demonstrates the MCP protocol in action. Toggle with a small "MCP" tab button in the header. Useful for judges who want to understand the technical depth.

---

### 8.7 Update .env.example

**File: `.env.example`** (MODIFY)

**Task:** Add new environment variable sections and remove MongoDB.

**Remove entirely:** The `Database (MongoDB)` section with `MONGODB_URI`

**Add sections:**

```
# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key

# Gemini AI
GEMINI_API_KEY=AIza...your-gemini-key

# OpenHands Agent
OPENHANDS_API_URL=http://localhost:3001

# MCP Servers
LEFT_BRAIN_MCP_URL=http://localhost:4001
RIGHT_BRAIN_MCP_URL=http://localhost:4002

# Demo Mode (for presentations)
DEMO_MODE=false
NEXT_PUBLIC_DEMO_MODE=false
```

---

## Demo Script (5-7 Minutes)

This is the recommended presentation flow for the hackathon:

| Time | Action | What judges see |
|------|--------|----------------|
| 0:00-0:15 | **Login** | Dark, professional UI. Immediate "this is polished" impression. |
| 0:15-0:45 | **Create Project** | Enter GitHub URL, drag-drop 2 video files. Multi-step form with progress bar. Click "Begin Transmutation" → Neural Handshake boot animation. |
| 0:45-1:15 | **Processing** | Both brains animate in real-time (tool calls, observations streaming). Left Brain analyzes code, Right Brain extracts behaviors. |
| 1:15-2:00 | **Migration Plan** | Interactive dependency graph with synapse-animated edges. Click through slices, show contracts. Explain vertical slice architecture. |
| 2:00-2:15 | **Select & Build** | Click a slice, show its contracts, hit "Build". Neural Handshake overlay → Glass Brain Dashboard activates. |
| 2:15-5:15 | **Glass Brain Dashboard** (THE MONEY SHOT) | Three panes come alive. Watch: thoughts appear (right), code streams character-by-character (center, Ghost Typer), plan updates (left). **Test fails** → glitch effect, error sounds. **Self-heal** → spotlight mode, diagnosis card, purple glow. Agent fixes and re-tests. **Confidence climbs** from ~61% to 91%. Gauge turns green, glow intensifies. Sound cues throughout. |
| 5:15-5:45 | **Victory Lap** | Ship Ready overlay, QR code to live preview, confetti. Show the working modern component in a browser tab. |
| 5:45-6:15 | **Cost Ticker** | Point to cost comparison: "$4,200 human estimate vs $0.47 Lazarus cost". Business value story. |
| 6:15-7:00 | **Q&A / Chaos Button** | Invite a judge to press the Chaos Button. Watch the agent self-heal a new injected failure in real-time. Interactive moment. |

---

## Complete File Manifest Summary

### Files to DELETE (6):
- `lib/db/prisma.ts`
- `lib/db/mongoose.ts`
- `lib/db/mongodb.ts`
- `lib/models/index.ts`
- `lib/models/billing.ts`
- `prisma/schema.prisma`

### Files to CREATE (~42+):
```
# Database & Infrastructure
lib/db/supabase.ts
lib/db/supabase-browser.ts
lib/db/types.ts
docs/supabase-schema.sql

# AI / Gemini
lib/ai/gemini.ts
lib/ai/gemini-planner.ts
lib/ai/thought-signatures.ts
lib/ai/confidence-explainer.ts

# Hooks
hooks/use-agent-events.ts
hooks/use-project.ts
hooks/use-slices.ts

# Glass Brain Dashboard (Base)
components/ai/glass-brain/glass-brain-dashboard.tsx
components/ai/glass-brain/plan-pane.tsx
components/ai/glass-brain/work-pane.tsx
components/ai/glass-brain/thoughts-pane.tsx
components/ai/glass-brain/confidence-gauge.tsx

# Glass Brain Dashboard (Phase 4 Upgrade — Demo-Worthy)
components/ai/glass-brain/derive-stats.ts
components/ai/glass-brain/header-stats.tsx
components/ai/glass-brain/confidence-sparkline.tsx
components/ai/glass-brain/plan-pane-enhanced.tsx
components/ai/glass-brain/work-pane-enhanced.tsx
components/ai/glass-brain/activity-timeline.tsx
components/ai/glass-brain/victory-lap.tsx
components/ai/glass-brain/ambient-effects.tsx

# Glass Brain Dashboard (Phase 5 Upgrade — Demo-Worthy Build Experience)
components/ai/glass-brain/derive-build-phase.ts
components/ai/glass-brain/build-phase-indicator.tsx
components/ai/glass-brain/cost-ticker.tsx
components/ai/glass-brain/agent-brain-viz.tsx
components/ai/glass-brain/build-pipeline-tracker.tsx
components/ai/glass-brain/build-narrative-bar.tsx
components/ai/glass-brain/self-heal-arc.tsx
components/ai/glass-brain/mcp-tool-inspector.tsx
components/ai/glass-brain/chaos-button.tsx

# Glass Brain Dashboard (Phase 5B — Browser Testing & Live View)
components/ai/glass-brain/browser-stream-panel.tsx
components/ai/glass-brain/screenshot-gallery.tsx

# Testing & Seeding
lib/testing/seed-test-user.ts
app/api/testing/seed/route.ts

# Supabase Migration (Phase 5B)
supabase/migrations/20260208020000_add_browser_event_types.sql

# Glass Brain Dashboard (Future Enhancements)
components/ai/glass-brain/ghost-cursor.tsx          (enhancement)
components/ai/glass-brain/time-travel-slider.tsx     (enhancement)

# Project Components
components/projects/project-card.tsx
components/projects/project-list.tsx
components/projects/upload-zone.tsx
components/projects/github-url-input.tsx

# Slice Components
components/slices/slice-graph.tsx
components/slices/slice-card.tsx
components/slices/slice-list.tsx
components/slices/slice-status-badge.tsx

# Providers
components/providers/supabase-provider.tsx

# Pages
app/(dashboard)/layout.tsx
app/(dashboard)/page.tsx
app/(dashboard)/projects/page.tsx
app/(dashboard)/projects/new/page.tsx
app/(dashboard)/projects/[id]/page.tsx
app/(dashboard)/projects/[id]/plan/page.tsx

# API Routes
app/api/projects/route.ts
app/api/projects/[id]/route.ts
app/api/projects/[id]/upload/route.ts
app/api/projects/[id]/process/route.ts
app/api/projects/[id]/slices/route.ts
app/api/projects/[id]/slices/[sliceId]/route.ts
app/api/projects/[id]/slices/[sliceId]/build/route.ts
app/api/projects/[id]/events/route.ts
app/api/mcp/left-brain/route.ts
app/api/mcp/right-brain/route.ts
app/api/gemini/route.ts

# Demo
lib/demo/mock-events.ts

# Audio Assets
public/sounds/keystroke.mp3
public/sounds/success.mp3
public/sounds/error.mp3
public/sounds/heal.mp3
public/sounds/confidence-tick.mp3
public/sounds/boot-up.mp3
```

### Files to MODIFY (~23):
```
package.json                       — Add/remove dependencies
env.mjs                            — Supabase/Gemini env vars, remove MongoDB
lib/auth/auth.ts                   — PostgreSQL adapter, rename to Project Lazarus
lib/db/index.ts                    — Re-export Supabase
lib/activity/feed.ts               — Supabase queries
lib/audit/logger.ts                — Supabase queries
lib/usage/tracker.ts               — Supabase queries
lib/queue/types.ts                 — Add ProjectProcessingJobData
lib/queue/queues.ts                — Add project-processing queue
lib/queue/workers.ts               — Add project processing worker
lib/ai/agent-runner.ts             — Add Gemini support, keep OpenAI fallback
lib/ai/tools/index.ts              — Supabase database query tool
lib/utils/constants.ts             — Update app name/description
app/layout.tsx                     — Update metadata
app/page.tsx                       — Lazarus landing page
app/(admin)/admin/page.tsx         — Supabase queries
app/api/webhooks/stripe/route.ts   — Supabase subscription upserts
components/providers/index.tsx     — Add SupabaseProvider
proxy.ts                           — Add /projects to protectedRoutes
docker-compose.yml                 — Add OpenHands service, rename containers
.env.example                       — Add Supabase vars, remove MongoDB
styles/tailwind.css                — Phase 5 Upgrade: particle-flow keyframes, glow-red utilities
components/ai/glass-brain/header-stats.tsx        — Phase 5 Upgrade: brain viz, phase indicator, MCP toggle
components/ai/glass-brain/work-pane-enhanced.tsx   — Phase 5 Upgrade: SelfHealArc overlay; Phase 5B: Tabs, EVENT_CONFIG, BrowserStreamPanel, ScreenshotGallery
components/ai/glass-brain/work-pane.tsx            — Phase 5B: EVENT_CONFIG entries for 3 new types
components/ai/glass-brain/glass-brain-dashboard.tsx — Phase 5 Upgrade: wire all 9 new components; Phase 5B: novncUrl + screenshots
components/ai/glass-brain/derive-stats.ts          — Phase 5B: EVENT_COLORS + status labels for browser events
components/ai/glass-brain/derive-build-phase.ts    — Phase 5B: browser_action → visual_check, phase + brain derivation
components/ai/glass-brain/build-narrative-bar.tsx   — Phase 5B: narrative text for browser_action, screenshot, app_start
hooks/use-agent-events.ts                          — Phase 5B: sound effects for 3 new event types
lib/db/types.ts                                    — Phase 5B: AgentEventType extended with 3 new types
```

---

## End-to-End Verification

After full implementation, verify:

1. `pnpm build` completes without errors
2. Auth flows work (login, register, verify-email) with Supabase/Better Auth
3. Project creation: upload GitHub URL + videos → processing triggers
4. Two Brains analysis: Left Brain code parsing + Right Brain video extraction
5. Vertical slices generated by Gemini and displayed in dependency graph
6. Synapse edge animations work on the dependency graph
7. Glass Brain Dashboard renders with real-time event updates
8. Ghost Typer effect works for code_write events
9. Sound effects play on key events
10. Glitch effect triggers on test failures
11. Self-Healing Spotlight dims other panes during diagnosis
12. Confidence gauge updates live with color interpolation and jitter
13. OpenHands agent can be triggered and streams events back
14. Self-healing loop: test failure → diagnosis → fix → re-test → pass
15. Victory Lap overlay shows on Ship Ready
16. Demo mode plays back pre-recorded events reliably with spacebar pause
17. Cost Ticker shows comparison
18. Chaos Button injects a failure for interactive demo
19. Landing page looks award-winning with Legacy Crumble animation
20. `pnpm test` passes, `pnpm e2e:headless` passes
21. New event types (`browser_action`, `screenshot`, `app_start`) accepted by POST `/api/projects/[id]/events`
22. Work pane shows 3 tabs: Events, Browser, Screenshots
23. Browser tab shows noVNC iframe (or "not configured" placeholder when env not set)
24. Screenshot gallery renders from screenshot events with lightbox viewer
25. Narrative bar displays browser-specific narrations
26. Pipeline tracker activates visual_check step on browser events
27. derive-stats shows correct colors and labels for new event types
28. `POST /api/testing/seed` creates test user in dev mode, returns 403 in production

---

<a id="pipeline-lifecycle"></a>
## Pipeline Lifecycle: Checkpoint/Resume System

### Overview

The project lifecycle (Create → Upload → Process → Plan → Build Slices → Complete) previously ran as a monolith — a crash after Left Brain meant redoing everything. This system adds:

1. **Checkpointing** at each pipeline step (Left Brain, Right Brain, Planning)
2. **Smart resume/retry** — resume from checkpoint or full restart
3. **Automated slice orchestration** — event-driven "Build All Slices" flow
4. **Event→status transitions** — `test_result`/`self_heal` events update slice status
5. **Real job cancellation** — "Pause" cancels the BullMQ job and sets `paused` status
6. **Structured error context** — queryable error info stored in project row
7. **Idempotent planning** — delete-before-insert prevents duplicate slices on retry

### Status: ✅ COMPLETE

### Files Overview

**Created (8 files):**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260209010000_add_pipeline_lifecycle.sql` | Adds 5 columns to projects table, updates status CHECK for `'paused'` |
| `lib/pipeline/types.ts` | `PipelineStep`, `PipelineCheckpoint`, `ErrorContext` types, constants |
| `lib/pipeline/orchestrator.ts` | Checkpoint CRUD, error context, pipeline step management |
| `lib/pipeline/slice-builder.ts` | Event-driven slice build orchestration |
| `lib/pipeline/index.ts` | Barrel exports |
| `app/api/projects/[id]/resume/route.ts` | Resume from checkpoint API |
| `app/api/projects/[id]/build/route.ts` | Start automated build pipeline for all slices |
| `app/api/projects/[id]/slices/[sliceId]/retry/route.ts` | Retry a single failed slice |

**Modified (10 files):**

| File | Changes |
|------|---------|
| `lib/db/types.ts` | `'paused'` added to `ProjectStatus`, 5 new columns in projects Row/Insert/Update |
| `lib/queue/types.ts` | `SLICE_BUILD` queue name, `SliceBuildJobData` type |
| `lib/queue/queues.ts` | `getSliceBuildQueue()`, `queueSliceBuild()` with deterministic job IDs |
| `lib/queue/index.ts` | Export new queue helpers + types |
| `lib/queue/workers.ts` | `processProjectJob` refactored: checkpoint load/save/skip, pause checks, error context, idempotent planning |
| `app/api/projects/[id]/events/route.ts` | `handleEventSideEffects()` for event→status transitions |
| `app/api/projects/[id]/retry/route.ts` | Smart retry with `?mode=resume\|restart\|auto` |
| `app/api/projects/[id]/route.ts` | PATCH stop: cancel BullMQ job, use `"paused"` status |
| `components/projects/project-detail-actions.tsx` | Resume, Build All Slices, Pause buttons |
| `app/(dashboard)/projects/[id]/page.tsx` | `paused` status, pipeline step display, error context card |
| `components/projects/project-card.tsx` | `paused` added to statusColors/statusIcons maps |
| `components/slices/slice-detail-sheet.tsx` | "Retry This Slice" button for failed slices |

---

### SQL Migration

**File:** `supabase/migrations/20260209010000_add_pipeline_lifecycle.sql`

Adds 5 new columns to the `projects` table:

| Column | Type | Purpose |
|--------|------|---------|
| `pipeline_step` | TEXT | Current step: `left_brain`, `right_brain`, `planning`, `slice:<uuid>` |
| `pipeline_checkpoint` | JSONB (default `{}`) | Checkpoint state: `completed_steps[]`, cached results |
| `error_context` | JSONB (nullable) | Structured error: step, message, timestamp, retryable, stack |
| `current_slice_id` | UUID FK → vertical_slices | Currently building slice |
| `build_job_id` | TEXT | BullMQ job ID for cancellation |

Updates `projects_status_check` constraint to include `'paused'`.

---

### Pipeline Types

**File:** `lib/pipeline/types.ts`

```
PipelineStep = "left_brain" | "right_brain" | "planning" | `slice:${string}`

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

---

### Pipeline Orchestrator

**File:** `lib/pipeline/orchestrator.ts`

All functions use `(supabase as any).from()` pattern. Pipeline audit events use `event_type: "thought"` with `metadata.pipeline_event` field — no new `AgentEventType` values (avoids cascading updates to all exhaustive `Record<AgentEventType, ...>` maps in UI components).

| Function | Purpose |
|----------|---------|
| `saveCheckpoint(projectId, checkpoint)` | Updates `pipeline_checkpoint` JSONB + `pipeline_step`, inserts audit event |
| `loadCheckpoint(projectId)` | Returns `PipelineCheckpoint \| null` from project row |
| `advancePipelineStep(projectId, step)` | Updates `pipeline_step` column |
| `setErrorContext(projectId, error)` | Stores structured error + inserts audit event |
| `clearErrorContext(projectId)` | Sets `error_context = null` |
| `storeBuildJobId(projectId, jobId)` | Stores BullMQ job ID for cancellation |
| `canResume(project)` | Returns true if checkpoint exists and status is `failed`/`paused` |
| `clearCheckpoint(projectId)` | Resets all pipeline state columns to null/empty |

---

### Slice Builder

**File:** `lib/pipeline/slice-builder.ts`

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

---

### Worker Refactor

**File:** `lib/queue/workers.ts`

`processProjectJob` refactored with checkpoint support:

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
```

On error: `setErrorContext()` with step name + message + stack, then status="failed".

---

### Event → Status Transitions

**File:** `app/api/projects/[id]/events/route.ts`

`handleEventSideEffects()` runs after event insert + confidence update:

| Event | Side Effect |
|-------|-------------|
| `test_run` | slice.status = "testing" (skip if already testing) |
| `test_result` + passed + confidence ≥ 0.85 | `onSliceComplete()` → triggers next slice |
| `test_result` + failed | `onSliceFailed()` → retry or mark failed |
| `self_heal` | slice.status = "self_healing" |

Fetches `project.user_id` for orchestration calls.

---

### API Routes

**Resume:** `POST /api/projects/[id]/resume` — Checks `canResume()`. If true: clear error, set processing, re-queue. If false: 400.

**Build All:** `POST /api/projects/[id]/build` — Verifies status is "ready" or "paused". Calls `startBuildPipeline()`. Returns 202.

**Slice Retry:** `POST /api/projects/[id]/slices/[sliceId]/retry` — Verifies slice is "failed". Resets to "pending". Clears error. Sets project to "building". Triggers next slice.

**Smart Retry:** `POST /api/projects/[id]/retry?mode=resume|restart|auto` — `resume` keeps checkpoint; `restart` clears everything; `auto` resumes if checkpoint exists, else restarts.

**Enhanced Stop:** `PATCH /api/projects/[id]` with `status: "paused"` — Fetches `build_job_id`, attempts `job.remove()` (best-effort), then updates status.

---

### Frontend Changes

**Project Detail Actions (`components/projects/project-detail-actions.tsx`):**
- New props: `pipelineStep`, `hasCheckpoint`, `errorContext`
- Resume button (when paused/failed with checkpoint)
- Build All Slices button (when ready, rail-fade style)
- Pause button replaces Stop (sends `"paused"` instead of `"pending"`)
- Retry only shows when failed and no checkpoint available

**Project Detail Page (`app/(dashboard)/projects/[id]/page.tsx`):**
- `paused` added to `statusConfig` (warning/Pause icon)
- Pipeline step shown as sub-label under status badge (e.g., "Processing — left brain")
- Error context card (AlertCircle, step name, message, timestamp, retryable badge)
- Glass Brain Dashboard shows for both `"building"` AND `"paused"` statuses
- Passes `pipelineStep`, `hasCheckpoint`, `errorContext` to actions

**Project Card (`components/projects/project-card.tsx`):**
- `paused` added to `statusColors` and `statusIcons` maps

**Slice Detail Sheet (`components/slices/slice-detail-sheet.tsx`):**
- "Retry This Slice" button for `slice.status === "failed"`
- Optimistic update to pending, POST to `/api/projects/[id]/slices/[sliceId]/retry`

---

### Key Design Decisions

1. **No new AgentEventType values.** Pipeline audit events use `thought` with `metadata.pipeline_event`. Avoids updating exhaustive `Record<AgentEventType, ...>` maps in work-pane.tsx, work-pane-enhanced.tsx, derive-stats.ts, etc.

2. **"paused" instead of reverting to "pending".** Preserves the semantic that work was in progress. Enables resume UX.

3. **Checkpoint in project row, not Redis.** Survives Redis restarts. Visible to frontend. Queryable.

4. **Slice builder is event-driven.** `test_result(pass)` → events route → `onSliceComplete` → `triggerNextSliceBuild`. No polling.

5. **Delete-before-insert for idempotent planning.** Prevents duplicate slices on retry/resume.

6. **BullMQ manages process-level retries (2 attempts). Orchestrator manages logical retries** (checkpoint resume). Separate concerns.

---

<a id="pipeline-lifecycle-verification-checklist"></a>
### Pipeline Lifecycle Verification Checklist

- [ ] `pnpm build` passes
- [ ] Create project → process → observe `pipeline_step` updating (left_brain → right_brain → planning)
- [ ] Simulate failure after Left Brain → verify `error_context` populated, status="failed"
- [ ] Resume from checkpoint → verify Left Brain skipped, Right Brain runs
- [ ] Stop during processing → verify status="paused", BullMQ job cancelled
- [ ] Resume from pause → pipeline continues from checkpoint
- [ ] Retry with `?mode=restart` → full reset
- [ ] "Build All Slices" → slices build in priority order respecting dependencies
- [ ] test_result(fail) → retry_count incremented, self_healing status
- [ ] Max retries exceeded → slice="failed", pipeline pauses
- [ ] Retry single failed slice → resets to pending, triggers build
- [ ] All slices complete → project status="complete"
- [ ] Error context card visible on project detail page
- [ ] Resume button appears when paused/failed with checkpoint
- [ ] Slice detail sheet shows "Retry This Slice" for failed slices

---

### Pipeline Lifecycle File Manifest

```
supabase/migrations/20260209010000_add_pipeline_lifecycle.sql
lib/pipeline/types.ts
lib/pipeline/orchestrator.ts
lib/pipeline/slice-builder.ts
lib/pipeline/index.ts
lib/db/types.ts                                    — Pipeline Lifecycle: 'paused' status, 5 new columns
lib/queue/types.ts                                  — Pipeline Lifecycle: SLICE_BUILD queue, SliceBuildJobData
lib/queue/queues.ts                                 — Pipeline Lifecycle: getSliceBuildQueue(), queueSliceBuild()
lib/queue/index.ts                                  — Pipeline Lifecycle: exports
lib/queue/workers.ts                                — Pipeline Lifecycle: checkpoint load/save/skip, pause checks
app/api/projects/[id]/resume/route.ts
app/api/projects/[id]/build/route.ts
app/api/projects/[id]/slices/[sliceId]/retry/route.ts
app/api/projects/[id]/events/route.ts               — Pipeline Lifecycle: handleEventSideEffects()
app/api/projects/[id]/retry/route.ts                 — Pipeline Lifecycle: smart retry with mode param
app/api/projects/[id]/route.ts                       — Pipeline Lifecycle: PATCH pause + BullMQ job cancel
components/projects/project-detail-actions.tsx        — Pipeline Lifecycle: Resume, Build All, Pause
components/projects/project-card.tsx                  — Pipeline Lifecycle: paused status colors/icons
app/(dashboard)/projects/[id]/page.tsx               — Pipeline Lifecycle: paused config, error card, pipeline step
components/slices/slice-detail-sheet.tsx              — Pipeline Lifecycle: Retry This Slice button
```
