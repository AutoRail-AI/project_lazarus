# Project Lazarus - Implementation Guide (Part 3: Phases 5-8)

Continues from `IMPLEMENTATION_PART2.md` (Phases 1-4). This document covers the backend integration, AI services, testing strategy, landing page, and demo mode with all theatrical enhancements.

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

# Glass Brain Dashboard
components/ai/glass-brain/glass-brain-dashboard.tsx
components/ai/glass-brain/plan-pane.tsx
components/ai/glass-brain/work-pane.tsx
components/ai/glass-brain/thoughts-pane.tsx
components/ai/glass-brain/confidence-gauge.tsx
components/ai/glass-brain/ghost-cursor.tsx          (enhancement)
components/ai/glass-brain/time-travel-slider.tsx     (enhancement)
components/ai/glass-brain/cost-ticker.tsx            (enhancement)
components/ai/glass-brain/chaos-button.tsx           (enhancement)
components/ai/glass-brain/victory-lap.tsx            (enhancement)

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

### Files to MODIFY (~20):
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
