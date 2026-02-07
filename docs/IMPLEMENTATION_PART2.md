# Project Lazarus - Implementation Guide (Part 2: Phases 1-4)

Continues from `IMPLEMENTATION.md` (Phase 0). This document covers the UI shell, upload flow, vertical slice visualization, and the centerpiece Glass Brain Dashboard with all theatrical enhancements.

**Reference Documentation:**
- [Ideation & Vision](project_lazarus.md)
- [System Architecture](ARCHITECTURE.md)
- [UI/UX Design System](UI_UX_GUIDE.md)
- [Brand Guidelines](../brand/brand.md)
- [**Phase 2 Left Brain (Code-Synapse) Integration Plan**](PHASE2_LEFT_BRAIN_INTEGRATION.md) — **Critical:** Left Brain is Code-Synapse CLI in Daytona sandboxes. Daytona MCP ([docs](https://www.daytona.io/docs/en/mcp)), Daytona SDK ([docs](https://www.daytona.io/docs/en/typescript-sdk/)). Read before implementing Phase 2/5.

---

<a id="phase-1"></a>
## PHASE 1: Core UI Shell & Routing

### 1.0 Implementation Details

**Completed Tasks:**
- [x] **1.1 Dashboard Shell Layout:** Created `app/(dashboard)/layout.tsx` with Sidebar.
- [x] **1.2 Projects List Page:** Created `app/(dashboard)/projects/page.tsx` and redirect.
- [x] **1.3 Supabase Provider:** Implemented `SupabaseProvider`.
- [x] **1.4 Update Providers Index:** Wrapped app in `SupabaseProvider`.
- [x] **UI Components:** Created `Sidebar`, `ProjectCard`, `ProjectList` with "Void Black" design system.
- [x] **Enhancement — Logo:** Sidebar uses `Logo` component (`@/components/branding`) with `variant="on-dark"` for brand consistency.
- [x] **Enhancement — Neural Activity Pulse:** Pulsing electric-cyan dot in sidebar header when any project has `status` in `["processing", "building"]`; fetched in layout and passed as `hasActiveBuild` prop.
- [x] **Enhancement — Magic UI Background:** CSS grid pattern (Magic UI-style) applied to sidebar via inline `backgroundImage` for subtle high-tech texture. *Note: The npm package `magic-ui` is unrelated (wrong package); for full Magic UI components use `pnpm dlx shadcn@latest add "https://shadcnregistry.com/r/magicui/grid-pattern"`.*

### 1.1 Dashboard Shell Layout

**File: `app/(dashboard)/layout.tsx`** (NEW)

**Task:** Create the main dashboard shell with sidebar navigation, session validation, and dark theme.

> 💡 **Tip:** Use `user-next-devtools-nextjs_index` to verify the running app's route structure and available tools during development.

**Key decisions:**
- Server component — fetch session via `auth.api.getSession({ headers })` and redirect to `/login` if missing
- Sidebar: fixed 64-wide, dark background using `--color-sidebar` tokens
- Logo: "L" badge with rail-purple gradient + "Project Lazarus" in `font-grotesk`
- User section at bottom: avatar initial circle + name + email

**Navigation items:**

| Icon | Label | Route |
|------|-------|-------|
| LayoutDashboard | Projects | `/projects` |
| PlusCircle | New Project | `/projects/new` |
| CreditCard | Billing | `/billing` |
| Settings | Settings | `/settings` |

**Layout pseudo code:**
```
<div class="flex h-screen bg-void-black">
  <aside class="w-64 border-r bg-sidebar">
    <Logo />
    <Nav items={navItems} />
    <UserSection session={session} />
  </aside>
  <main class="flex-1 overflow-y-auto p-6">
    {children}
  </main>
</div>
```

**Enhancement — Neural Activity Pulse:**
Add a subtle animated indicator in the sidebar header that pulses when any project has an active build. Use a small dot with `animate-pulse` that glows electric-cyan when agents are working. This gives the dashboard a "living system" feel even before entering a project.

**Enhancement — Magic UI Background:**
Use **Magic UI** `Particles` or `GridPattern` component for the sidebar background to give it a subtle, high-tech texture that differentiates it from the main content area.

---

### 1.2 Projects List Page (Dashboard Home)

**File: `app/(dashboard)/page.tsx`** (NEW)

**Task:** Simple redirect from dashboard root to `/projects`.

```
redirect("/projects")
```

**File: `app/(dashboard)/projects/page.tsx`** (NEW — actual projects list)

**Task:** Server component that fetches the current user's projects from Supabase and renders them in a grid.

**Key steps:**
1. Get session via `auth.api.getSession`
2. Query `supabase.from("projects").select("*").eq("user_id", session.user.id).order("created_at", desc)`
3. Render header with "New Project" CTA button
4. Render `<ProjectList projects={projects} />`

---

### 1.3 Supabase Provider

**File: `components/providers/supabase-provider.tsx`** (NEW)

**Task:** Create a React context provider that supplies the browser-side Supabase client to child components.

**Key decisions:**
- `"use client"` directive
- Use `useMemo` to create client once via `getSupabaseBrowserClient()`
- Wrap in try/catch in case env vars are missing (graceful degradation)
- Export `useSupabase()` hook that throws if used outside provider

**Pseudo code:**
```
const SupabaseContext = createContext(null)

export function SupabaseProvider({ children }):
  client = useMemo(() -> try getSupabaseBrowserClient() catch null)
  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>

export function useSupabase():
  ctx = useContext(SupabaseContext)
  if not ctx: throw "Must be used within SupabaseProvider"
  return ctx
```

---

### 1.4 Update Providers Index

**File: `components/providers/index.tsx`** (MODIFY)

**Task:** Add `SupabaseProvider` to the provider tree, wrapping it around `AnalyticsProvider`.

**Pseudo code:**
```
<AuthProvider>
  <SupabaseProvider>
    <AnalyticsProvider>
      {children}
      <Toaster />
    </AnalyticsProvider>
  </SupabaseProvider>
</AuthProvider>
```

Re-export `SupabaseProvider` and `useSupabase` from this file.

---

### Phase 1 Verification Checklist

**Status: ✅ COMPLETE**

- [x] Dashboard layout loads with Sidebar, redirects unauthenticated users to `/login`
- [x] Root `/` (dashboard) redirects to `/projects`
- [x] `/projects` fetches projects from Supabase, renders `ProjectList`
- [x] Sidebar uses `Logo` component with "L" badge and "Project Lazarus"
- [x] Navigation: Projects, New Project, Billing, Settings
- [x] User section: avatar, name, email, dropdown (Upgrade, Profile, Log out)
- [x] Neural Activity Pulse: electric-cyan pulsing dot when projects have `processing` or `building` status
- [x] Sidebar background: subtle grid pattern for high-tech texture
- [x] `SupabaseProvider` wraps app; `useSupabase()` available

---

<a id="phase-2"></a>
## PHASE 2: Upload & Ingestion Flow

### 2.0 Phase 2 Architecture: Left Brain via Daytona + Code-Synapse

**Must read:** [PHASE2_LEFT_BRAIN_INTEGRATION.md](PHASE2_LEFT_BRAIN_INTEGRATION.md)

The Left Brain is **Code-Synapse CLI** — not an HTTP server. The processing flow uses **Daytona** (recommended) to:

1. Create a Daytona sandbox with `autoStopInterval: 0` (critical — prevents mid-process auto-stop)
2. Clone the GitHub repo into the sandbox via `sandbox.git.clone()`
3. Run `code-synapse index` and `code-synapse justify` (blocking)
4. Start `code-synapse start --port 3100` in a background session
5. Get preview URL for port 3100 and query Code-Synapse MCP (`get_feature_map`, `get_slice_dependencies`, `get_migration_context`)
6. Store results in `project.metadata.code_analysis`

**Why Daytona:** Process runs on remote infrastructure — laptop sleep or battery death does not kill the analysis. Fallback: temp dir + subprocess when Daytona is not configured.

**References:** Daytona MCP ([docs](https://www.daytona.io/docs/en/mcp)), Daytona TypeScript SDK ([docs](https://www.daytona.io/docs/en/typescript-sdk/)).

---

### 2.0.2 Phase 2 Implementation Status

**Status: ✅ COMPLETE** (no mock or TODO data in Phase 2 scope)

| Item | File / Location | Notes |
|------|-----------------|-------|
| 2.1 Project Card | `components/projects/project-card.tsx` | Status badges, confidence, link to `/projects/[id]` |
| 2.2 Project List | `components/projects/project-list.tsx` | Grid, empty state |
| 2.3 GitHub URL Input | `components/projects/github-url-input.tsx` | Validated input, repo name display |
| 2.4 Upload Zone | `components/projects/upload-zone.tsx` | Drag-drop, video/document types |
| 2.5 Project Creation Page | `app/(dashboard)/projects/new/page.tsx` | Multi-step form, create → upload → process → redirect |
| 2.6 Project CRUD API | `app/api/projects/route.ts` | GET list, POST create |
| 2.7 Project Detail API | `app/api/projects/[id]/route.ts` | GET/PATCH, ownership check |
| 2.8 Upload API | `app/api/projects/[id]/upload/route.ts` | Presigned URL, `project_assets` insert |
| 2.9 Process Trigger API | `app/api/projects/[id]/process/route.ts` | Queue `queueProjectProcessing` |
| 2.10 Slices API | `app/api/projects/[id]/slices/route.ts` | GET slices by project |
| 2.11 Slice Detail | `app/api/projects/[id]/slices/[sliceId]/route.ts` | GET single slice |
| 2.11 Slice Build | `app/api/projects/[id]/slices/[sliceId]/build/route.ts` | POST → OpenHands (202) |
| 2.12 Events API | `app/api/projects/[id]/events/route.ts` | POST callback, GET with `?after=` |
| 2.13 MCP Proxy | `app/api/mcp/left-brain/route.ts`, `right-brain/route.ts` | Forward to LEFT/RIGHT_BRAIN_MCP_URL |
| Project Detail Page | `app/(dashboard)/projects/[id]/page.tsx` | Status, confidence, slices list, View Plan when ready |
| Worker | `lib/queue/workers.ts` | `processProjectJob`: Daytona/local Code-Synapse, Right Brain, Gemini planner, slice insert |
| Code-Synapse runner | `lib/workspaces/code-synapse-runner.ts` | Daytona or local checkout + CLI |
| Daytona runner | `lib/daytona/runner.ts` | Create sandbox, clone, exec, preview link |
| MCP client | `lib/mcp/code-synapse-client.ts` | getFeatureMap, getSliceDependencies, getMigrationContext |
| Gemini planner | `lib/ai/gemini-planner.ts` | generateSlices(project) |

---

### 2.0.1 Phase 2 User Flow

End-to-end journey from project creation to analysis complete:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 2 USER FLOW                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. ENTRY                                                                        │
│     User lands on /projects — sees project list (or empty state)                 │
│     Clicks "New Project" in header or sidebar                                    │
│                                                                                  │
│  2. NEW PROJECT (/projects/new) — Multi-step form                                │
│     ┌─────────────────────────────────────────────────────────────────────────┐  │
│     │ Step 0: Project Basics                                                   │  │
│     │   Name (required), description, target framework (Next.js/React/Vue)     │  │
│     │   → Next                                                                │  │
│     ├─────────────────────────────────────────────────────────────────────────┤  │
│     │ Step 1: Source Code                                                      │  │
│     │   GitHub URL input (validated)                                           │  │
│     │   → Next                                                                │  │
│     ├─────────────────────────────────────────────────────────────────────────┤  │
│     │ Step 2: Knowledge Assets                                                 │  │
│     │   Video upload zone (.mp4, .mov, etc.)                                   │  │
│     │   Document upload zone (.pdf, .md, .txt)                                 │  │
│     │   → Next                                                                │  │
│     ├─────────────────────────────────────────────────────────────────────────┤  │
│     │ Step 3: Review & Launch                                                  │  │
│     │   Summary card with all inputs                                           │  │
│     │   Click "Begin Transmutation"                                            │  │
│     └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  3. SUBMISSION                                                                   │
│     POST /api/projects → creates project (status: "pending")                     │
│     Upload files to Supabase Storage via /api/projects/[id]/upload               │
│     POST /api/projects/[id]/process → queues BullMQ job                          │
│     Redirect to /projects/[id]                                                   │
│                                                                                  │
│  4. PROJECT DETAIL (/projects/[id])                                              │
│     User lands on project page; status shows "processing"                        │
│     Neural Activity Pulse (electric-cyan dot) in sidebar header — active         │
│                                                                                  │
│  5. BACKGROUND PROCESSING (Worker)                                               │
│     Daytona sandbox → clone repo → code-synapse index → code-synapse justify     │
│     → code-synapse start (MCP) → query get_feature_map, get_slice_dependencies   │
│     → Right Brain (if configured) → Gemini planner → vertical slices             │
│     → project.status = "ready"                                                   │
│                                                                                  │
│  6. READY                                                                        │
│     User refreshes or navigates; project shows "ready"                           │
│     Phase 3: Plan page (/projects/[id]/plan) with slice dependency graph         │
│     Phase 4: Glass Brain Dashboard when building                                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1 Project Card Component

**File: `components/projects/project-card.tsx`** (NEW)

**Task:** Card component displaying project name, status badge, confidence score, and relative timestamp.

**Key details:**
- Wrap in a `<Link>` to `/projects/{id}`
- Status badge colors: pending=slate-grey, processing=electric-cyan, ready=rail-purple, building=warning, complete=success
- Show confidence as percentage when > 0
- Arrow icon appears on hover (opacity transition)
- Use `formatDistanceToNow` from `date-fns` for timestamps
- Apply `hover:glow-purple` for subtle hover glow effect

---

### 2.2 Project List Component

**File: `components/projects/project-list.tsx`** (NEW)

**Task:** Grid layout of ProjectCards with empty state.

**Key details:**
- If no projects: show centered dashed-border empty state with "No projects yet" message
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` with `gap-4`
- Accept `projects` array prop typed from Supabase `projects` table Row type

---

### 2.3 GitHub URL Input

**File: `components/projects/github-url-input.tsx`** (NEW)

**Task:** Validated GitHub URL input with visual feedback.

**Key details:**
- `"use client"` — needs state for validation
- GitHub icon on left side of input
- Regex validation: `^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$`
- Show green checkmark on valid, red X on invalid (after first interaction)
- Extract and display repo name (e.g., "owner/repo") below input when valid
- Controlled component: `value` and `onChange` props

---

### 2.4 Upload Zone

**File: `components/projects/upload-zone.tsx`** (NEW)

**Task:** Drag-and-drop file upload zone using `react-dropzone` (already in deps).

**Key details:**
- `"use client"` — uses drag-and-drop state
- Accepts `type` prop: `"video"` or `"document"`
- Video accepts: `.mp4`, `.mov`, `.webm`, `.avi`
- Document accepts: `.pdf`, `.md`, `.txt`
- Drag-active state: electric-cyan border and background tint
- File list below drop zone: icon + name + size in MB + remove button
- Generate object URL previews for video files

**Enhancement — Upload Theatrics:**
When files are dropped, show a brief "scanning" animation — a horizontal electric-cyan line sweeps across the file preview card, simulating analysis. Use `framer-motion` `layoutId` for smooth list transitions when files are added/removed.

---

### 2.5 Project Creation Page

**File: `app/(dashboard)/projects/new/page.tsx`** (NEW)

**Task:** Multi-step form for creating a new project, following the existing onboarding pattern.

> 💡 **Tip:** Refer to `docs/UI_UX_GUIDE.md` Section 5.7 for the exact visual spec of the upload flow.

**Steps:**

| Step | Content | Components |
|------|---------|-----------|
| 0: Project Basics | Name (Input), description (Textarea), target framework (Select: Next.js/React/Vue) | Existing shadcn Input, Textarea, native select |
| 1: Source Code | GitHub URL with validation | `GithubUrlInput` |
| 2: Knowledge Assets | Video upload zone, document upload zone | `UploadZone` (x2) |
| 3: Review & Launch | Summary card with all inputs, "Begin Transmutation" CTA | Card, Button |

**Key details:**
- Progress bar at top: shows step completion percentage with `rail-fade` gradient fill
- Step labels shown above progress bar, highlighted when active
- Back/Next navigation buttons at bottom
- "Next" disabled when current step validation fails (step 0: name required, step 1: URL required)
- Final submit: POST to `/api/projects`, then upload files via `/api/projects/[id]/upload`, then POST to `/api/projects/[id]/process`, then redirect to `/projects/[id]`

**Enhancement — "Begin Transmutation" CTA:**
The final CTA button should use the Sparkles icon with a subtle shimmer animation. On click, show a brief "Neural Handshake" full-screen overlay (1-2 seconds) with a radial gradient expanding from center before navigating — this creates a dramatic moment of initiation.

**Enhancement — Magic UI Sparkles:**
Use **Magic UI** `SparklesText` or `ShimmerButton` for the "Begin Transmutation" CTA to maximize the visual impact of this key action.

---

### 2.6 Project CRUD API

**File: `app/api/projects/route.ts`** (NEW)

**Task:** REST API for project list and creation.

| Method | Action | Auth | Query/Body |
|--------|--------|------|-----------|
| GET | List user's projects | Required | `supabase.from("projects").select("*").eq("user_id", session.user.id).order(desc)` |
| POST | Create a new project | Required | Body: `{ name, description?, githubUrl?, targetFramework? }` → insert with status "pending" |

---

### 2.7 Project Detail API

**File: `app/api/projects/[id]/route.ts`** (NEW)

**Task:** REST API for single project read and update.

| Method | Action | Auth | Notes |
|--------|--------|------|-------|
| GET | Fetch project by ID | Required | Filter by both `id` AND `user_id` for security |
| PATCH | Update project fields | Required | Accept partial update body, filter by both `id` AND `user_id` |

**Important:** In Next.js 16, route params are `Promise<{ id: string }>` — must `await params`.

---

### 2.8 Upload API

**File: `app/api/projects/[id]/upload/route.ts`** (NEW)

**Task:** Generate presigned Supabase Storage upload URLs for client-side direct upload.

**Flow:**
1. Validate session and project ownership
2. Accept body: `{ fileName, fileType (video|document), contentType }`
3. Determine bucket: `project-videos` or `project-documents` based on fileType
4. Generate storage path: `{projectId}/{timestamp}-{fileName}`
5. Call `supabase.storage.from(bucket).createSignedUploadUrl(path)`
6. Create `project_assets` record with status "pending"
7. Return `{ uploadUrl, token, asset }`

Client uses the returned URL to upload directly to Supabase Storage.

---

### 2.9 Process Trigger API

**File: `app/api/projects/[id]/process/route.ts`** (NEW)

**Task:** Trigger the Two Brains analysis pipeline.

**Flow:**
1. Validate session and project ownership
2. Update project status to "processing"
3. Queue a BullMQ job via `queueProcessing()` with `{ projectId, githubUrl, targetFramework }`
4. Return `{ status: "processing", projectId }`

The worker (Phase 5) handles the actual Left Brain/Right Brain processing. **Left Brain flow:** See [PHASE2_LEFT_BRAIN_INTEGRATION.md](PHASE2_LEFT_BRAIN_INTEGRATION.md) — Daytona sandbox + Code-Synapse CLI (clone → index → justify → start MCP → query MCP tools).

---

### 2.10 Slices API

**File: `app/api/projects/[id]/slices/route.ts`** (NEW)

**Task:** List vertical slices for a project.

| Method | Action |
|--------|--------|
| GET | Query `vertical_slices` filtered by `project_id`, ordered by `priority ASC` |

---

### 2.11 Slice Detail & Build API

**File: `app/api/projects/[id]/slices/[sliceId]/route.ts`** (NEW)

**Task:** GET a single slice by ID.

**File: `app/api/projects/[id]/slices/[sliceId]/build/route.ts`** (NEW)

**Task:** Trigger the OpenHands agent to build a slice.

**Flow:**
1. Validate session
2. Fetch slice with its contracts from Supabase
3. Update slice status to "building"
4. Construct agent payload: `{ slice_id, project_id, behavioral_contract, code_contract, modernization_flags, callback_url, max_retries: 5, confidence_threshold: 0.85 }`
5. POST to `OPENHANDS_API_URL`
6. Return 202 Accepted

---

### 2.12 Events API (SSE + Callback)

**File: `app/api/projects/[id]/events/route.ts`** (NEW)

**Task:** Dual-purpose endpoint — receives events from OpenHands (POST) and serves events to the dashboard (GET).

**POST (callback from OpenHands):**
1. Accept body: `{ slice_id?, event_type, content, metadata?, confidence_delta? }`
2. Insert into `agent_events` table
3. If `confidence_delta` provided and `slice_id` present, update the slice's `confidence_score` (clamped to 0-1)
4. Return `{ ok: true }`

**GET (dashboard polling fallback):**
1. Validate session
2. Accept `?after=timestamp` query param
3. Query `agent_events` filtered by project_id, ordered by created_at ASC, limit 100
4. If `after` param provided, filter with `.gt("created_at", after)`
5. Return events array

---

### 2.13 MCP Proxy Routes

**File: `app/api/mcp/left-brain/route.ts`** (NEW)
**File: `app/api/mcp/right-brain/route.ts`** (NEW)

**Task:** Simple HTTP proxies to the MCP servers.

**Flow (identical for both):**
1. Read the MCP URL from env (`LEFT_BRAIN_MCP_URL` / `RIGHT_BRAIN_MCP_URL`)
2. Return 500 if not configured
3. Forward the JSON body via `fetch(url, { method: "POST", body })`
4. Return the response JSON
5. Catch errors and return 500 with error message

---

<a id="phase-3"></a>
## PHASE 3: Vertical Slice Architecture & Plan View

### 3.1 Slice Status Badge

**File: `components/slices/slice-status-badge.tsx`** (NEW)

**Task:** Colored badge component for slice statuses.

**Status-to-style mapping:**

| Status | Label | Style |
|--------|-------|-------|
| pending | Pending | slate-grey bg, muted text |
| selected | Selected | rail-purple/20 bg, quantum-violet text |
| building | Building | electric-cyan/15 bg, electric-cyan text, `animate-pulse-glow` |
| testing | Testing | warning/15 bg, warning text |
| self_healing | Self-Healing | rail-purple/15 bg, rail-purple text |
| complete | Complete | success/15 bg, success text |
| failed | Failed | error/15 bg, error text |

---

### 3.2 Slice Card

**File: `components/slices/slice-card.tsx`** (NEW)

**Task:** Clickable card showing slice name, status badge, description, priority, confidence, and retry count.

**Key details:**
- `<button>` with `onClick` handler for slice selection
- `hover:glow-purple` transition effect
- Use `SliceStatusBadge` for status
- Show priority number, confidence percentage (when > 0), retry count (when > 0)

---

### 3.3 Slice List

**File: `components/slices/slice-list.tsx`** (NEW)

**Task:** Vertical list of SliceCards with empty state.

**Key details:**
- Accept `slices` array and optional `onSelect` callback
- Empty state: dashed border, "No slices generated yet"
- Render cards in a `space-y-3` stack

---

### 3.4 Slice Dependency Graph

**File: `components/slices/slice-graph.tsx`** (NEW)

**Task:** Interactive dependency graph using `@xyflow/react` (React Flow).

**Key decisions:**
- `"use client"` — React Flow requires client-side rendering
- Accept `slices` array, `onNodeClick` callback, `minimap` boolean (compact mode for Glass Brain)
- Generate nodes and edges from slices array using `useMemo`

**Node positioning:** Grid layout — `x = (index % 4) * 250`, `y = floor(index / 4) * 150`

**Node styling by status:**

| Status | Border color | Box shadow | Notes |
|--------|-------------|-----------|-------|
| pending | `rgba(250,250,250,0.1)` | none | |
| selected | `#6E18B3` (rail-purple) | purple glow | |
| building | `#00E5FF` (electric-cyan) | cyan glow | |
| testing | `#FFB800` (warning) | yellow glow | |
| self_healing | `#6E18B3` | purple glow | |
| complete | `#00FF88` (success) | green glow | |
| failed | `#FF3366` (error) | red glow | |

All nodes: `#1E1E28` background, `#FAFAFA` text, 12px border-radius, `font-grotesk`

**Edges:**
- Style: `rgba(250,250,250,0.15)` stroke, 1.5px width
- When source slice is `building`: set edge `animated: true` (dashed flow animation)
- Direction: dependency → dependent

**Enhancement — Synapse Edge Animations:**
Replace static edges with animated "synapse pulse" edges. When a slice transitions to `building`, animate a particle/pulse traveling along the dependency edges from completed parent nodes toward the building node. Use a custom React Flow edge component with a `framer-motion` animated circle that travels along the edge path. This makes the dependency graph feel like a living neural network.

**Enhancement — Node Status Transitions:**
When a node changes status (e.g., pending → building), apply a brief flash/bloom animation on the node. Use `framer-motion`'s `animate` with a scale pulse (1 → 1.1 → 1) and border glow intensification lasting ~300ms.

**Graph settings:**
- Background: `#0A0A0F` (void-black)
- Background dots: `rgba(250,250,250,0.03)` at 24px gap
- Minimap mode: smaller font (10px), smaller min-width (100px), no Controls panel
- Full mode: Controls panel visible, zoom range 0.5-2x

---

### 3.5 Plan Page

**File: `app/(dashboard)/projects/[id]/plan/page.tsx`** (NEW)

**Task:** Full-viewport migration plan page with interactive dependency graph.

**Layout:**
1. **Header bar:** Project name + status + confidence percentage + "X/Y slices complete" counter
2. **Main area:** Full-height `SliceGraph` component
3. (Future: bottom panel for selected slices queue, right sidebar for slice detail)

**Data fetching:** Server component — query `projects` and `vertical_slices` tables from Supabase.

---

<a id="phase-4"></a>
## PHASE 4: Glass Brain Dashboard

> **THIS IS THE KEY DIFFERENTIATOR.** The Glass Brain Dashboard is the real-time 3-pane HUD that visualizes the agent's cognition. This is what wins the hackathon. Every enhancement below is designed to maximize the theatrical "wow" factor.
>
> **Reference:** See `docs/UI_UX_GUIDE.md` Part V (Project Lazarus UI) for detailed layout specs, motion design, and theatrical effects.

### 4.1 Real-Time Events Hook

**File: `hooks/use-agent-events.ts`** (NEW)

**Task:** Custom React hook that subscribes to real-time agent events via Supabase Realtime, with polling fallback.

**Key behavior:**
1. Create a Supabase Realtime channel subscription on `agent_events` table filtered by `project_id`
2. On each INSERT event, add to local state array
3. Track `latestThought` (most recent `thought` type event)
4. Track `confidence` score (accumulate `confidence_delta` values, clamped 0-1)
5. Cleanup subscription on unmount

**Fallback:** If Supabase Realtime subscription fails (catch block), fall back to polling `/api/projects/[id]/events?after={lastTimestamp}` every 500ms.

**Pseudo code:**
```
export function useAgentEvents(projectId):
  [events, setEvents] = useState([])
  [latestThought, setLatestThought] = useState(null)
  [confidence, setConfidence] = useState(0)

  processEvent(event):
    setEvents(prev => [...prev, event])
    if event.type == "thought": setLatestThought(event)
    if event.confidence_delta: setConfidence(prev => clamp(prev + delta, 0, 1))

  useEffect:
    try:
      channel = supabase.channel("agent-events-{projectId}")
        .on("postgres_changes", { event: "INSERT", table: "agent_events", filter: project_id=eq.{projectId} }, processEvent)
        .subscribe()
    catch:
      // Polling fallback every 500ms
    return cleanup

  return { events, latestThought, confidence }
```

**Enhancement — Event Sound Hooks:**
Extend the hook to play audio cues on specific event types using `use-sound`:

| Event Type | Sound | Volume |
|-----------|-------|--------|
| `code_write` | keystroke.mp3 (rapid burst of 3-5) | 0.3 |
| `test_result` (pass) | success.mp3 | 0.5 |
| `test_result` (fail) | error.mp3 | 0.5 |
| `self_heal` | heal.mp3 | 0.6 |
| `confidence_update` | confidence-tick.mp3 | 0.4 |

Add a `muted` state toggle so presenters can disable sounds. Expose `toggleMute()` from the hook.

---

### 4.2 Confidence Gauge

**File: `components/ai/glass-brain/confidence-gauge.tsx`** (NEW)

**Task:** Full-width animated progress bar showing the overall confidence score with color interpolation and "Ship Ready" threshold.

**Key behavior:**
- Color interpolation: red (#FF3366) at 0% → yellow (#FFB800) at 50% → green (#00FF88) at 100%
- Animated width transition using `framer-motion`
- Percentage displayed in large `font-grotesk` text with scale+fade animation on change
- Gradient fill on the bar: `linear-gradient(90deg, #FF3366, #FFB800, #00FF88)`
- "Ship Ready" threshold line at 85% with label
- Glassmorphism container: `bg-card/60 backdrop-blur-xl border-border`

**Enhancement — Confidence Jitter:**
Add micro-animations to the confidence number: when the score changes, the number should briefly "jitter" (±1-2% oscillation over 500ms) before settling on the final value. This creates organic, biological-feeling uncertainty rather than robotic precision. Implement with `framer-motion` spring animation.

**Enhancement — Breakdown Tooltip:**
On hover, show a floating tooltip with the confidence breakdown:
```
Unit Tests: 15% weight — {score}
E2E Tests:  25% weight — {score}
Visual:     20% weight — {score}
Behavioral: 20% weight — {score}
Video Diff: 20% weight — {score}
```

**Enhancement — Glow Intensification:**
The entire gauge container should have a subtle box-shadow glow that intensifies as confidence rises:
- 0-40%: no glow
- 40-70%: faint warning-yellow glow
- 70-85%: moderate electric-cyan glow
- 85-100%: strong success-green glow with `animate-pulse-glow`

---

### 4.3 Plan Pane (Left — "The Plan")

**File: `components/ai/glass-brain/plan-pane.tsx`** (NEW)

**Task:** Compact dependency graph view showing overall migration progress.

**Key details:**
- Header: "The Plan" + "X/Y complete" counter
- Reuses `SliceGraph` component with `minimap={true}` mode
- Glassmorphism container: `bg-card/60 backdrop-blur-xl`
- Currently-building slice: electric-cyan glow with pulse animation
- Completed slices: fade to success-green

**Enhancement — Legacy Crumble Effect:**
When viewing the plan, completed slices should show a "dissolve" animation where the old legacy representation crumbles away (particles scatter) and the modern slice node solidifies. Implement with `framer-motion` particle effect on status transition from `building` → `complete`.

---

### 4.4 Work Pane (Center — "The Work")

**File: `components/ai/glass-brain/work-pane.tsx`** (NEW)

**Task:** Terminal-like streaming display showing agent activity in real-time. This is the most visually dramatic pane.

**Key details:**
- `font-mono` (JetBrains Mono), dark background
- Auto-scroll to bottom on new events; pause when user scrolls up; "Jump to latest" FAB appears
- Each event rendered with icon + styled text

**Event rendering by type:**

| Event Type | Icon | Text Style | Notes |
|-----------|------|-----------|-------|
| `thought` | Brain | Italic, muted foreground | Agent reasoning |
| `tool_call` | Wrench | Electric-cyan text | Tool name highlighted |
| `code_write` | Code | Foreground, code blocks | Syntax highlighted |
| `test_run` | Play | Warning-yellow text | Command being run |
| `test_result` (pass) | CheckCircle | Success-green text | Pass count shown |
| `test_result` (fail) | XCircle | Error-red text | Error details |
| `self_heal` | RotateCw | Rail-purple text | Retry count badge |
| `observation` | Eye | Dim foreground, indented | Sub-result of tool_call |
| `confidence_update` | CheckCircle | Muted foreground | Score update |

**Enhancement — Ghost Typer Effect:**
For `code_write` events, DON'T render the content all at once. Instead, simulate typing character-by-character at ~30ms per character using a `requestAnimationFrame` loop. The cursor should be a blinking block cursor in electric-cyan. This makes it look like the agent is actively writing code in real-time. Once the typing completes, transition to static rendered text.

**Enhancement — Glitch Effect on Failure:**
When a `test_result` (fail) event appears, apply a brief CSS glitch effect to the entire Work Pane:
- Red scanline overlay (2px height, animating vertically) for 300ms
- Slight horizontal text displacement via `transform: translateX(±2px)` oscillation
- Screen "flicker" via opacity flash (1 → 0.8 → 1)
- This creates a visceral "something went wrong" moment

**Enhancement — Hacker Mode Code Streaming:**
For `code_write` events, render the code block with syntax highlighting (can be simple: keywords in electric-cyan, strings in success-green, comments in muted foreground). Add a subtle scanline overlay that moves vertically through the code block.

---

### 4.5 Thoughts Pane (Right — "The Thoughts")

**File: `components/ai/glass-brain/thoughts-pane.tsx`** (NEW)

**Task:** Agent's inner monologue / Thought Signatures displayed as stacked cards.

**Key details:**
- Filter events for `thought` and `self_heal` types
- Reverse chronological: latest at top
- Each card shows: relative timestamp, category badge, thought content, confidence delta
- `framer-motion` `AnimatePresence`: fade-in from top on new thoughts
- Decreasing opacity: card at index `i` has `opacity: max(0.3, 1 - i * 0.1)`
- `self_heal` events highlighted with rail-purple border and "Diagnosis" badge

**Category badge colors:**

| Category | Style |
|----------|-------|
| Planning | rail-purple/20 bg, quantum-violet text |
| Implementing | electric-cyan/15 bg, electric-cyan text |
| Testing | warning/15 bg, warning text |
| Debugging | error/15 bg, error text |
| Healing | rail-purple/15 bg, rail-purple text |

**Enhancement — Thought Card Entrance Animation:**
New thought cards should slide down from above with a brief "typewriter reveal" — the text appears word-by-word over ~500ms after the card animates into position. Use `framer-motion` `variants` with staggered word reveal.

**Enhancement — Self-Healing Spotlight Mode:**
When a `self_heal` event appears, temporarily dim the other two panes (Plan and Work) to 40% opacity and spotlight the Thoughts pane. The diagnosis card should have an intensified border glow (rail-purple, pulsing). After 3 seconds, restore normal opacity. This draws every eye to the "moment of diagnosis" during demos.

---

### 4.6 Glass Brain Dashboard

**File: `components/ai/glass-brain/glass-brain-dashboard.tsx`** (NEW)

**Task:** Main layout component that composes all three panes and the confidence gauge.

> 💡 **Tip:** Refer to `docs/UI_UX_GUIDE.md` Section 5.1 for the Glass Brain layout and Section 5.11 for theatrical effects.

**Layout (CSS Grid):**
```
+--------------------------------------------+
|  HEADER: Slice name + Status + Timer       |  h-12
+----------+----------------+----------------+
|          |                |                |
| THE PLAN | THE WORK       | THE THOUGHTS  |
| (left)   | (center)       | (right)       |
| 25%      | 50%            | 25%           |
|          |                |                |
+----------+----------------+----------------+
|        CONFIDENCE GAUGE                    |  h-20
+--------------------------------------------+
```

**Pseudo code:**
```
export function GlassBrainDashboard({ projectId, slices }):
  { events, confidence } = useAgentEvents(projectId)

  return (
    <div class="flex h-[calc(100vh-3rem)] flex-col gap-3">
      <div class="grid flex-1 grid-cols-[1fr_2fr_1fr] gap-3">
        <PlanPane slices={slices} />
        <WorkPane events={events} />
        <ThoughtsPane events={events} />
      </div>
      <ConfidenceGauge score={confidence} />
    </div>
  )
```

**Enhancement — Neural Handshake Boot Sequence:**
When the Glass Brain Dashboard first loads (build just started), play a 2-3 second "boot sequence" overlay:
1. Black screen with a single pulsing dot in the center
2. Lines radiate outward from the dot, forming a brain-like wireframe shape
3. The three panes "materialize" one by one (left, center, right) with a fade+slide-in
4. "NEURAL LINK ESTABLISHED" text appears briefly in electric-cyan, centered
5. Boot sequence fades out, revealing the live dashboard
6. Play `boot-up.mp3` sound during the sequence

This creates an unforgettable first impression every time a build starts.

**Enhancement — Ambient Background:**
Behind the three panes, render a subtle animated background:
- Very faint connection lines between the three panes (like synapses)
- Slow-moving particles (2-3 per second) that travel from Plan pane through Work pane to Thoughts pane
- Use CSS `::before` pseudo-elements with `@keyframes` for performance

**Enhancement — Magic UI Ambient:**
Use **Magic UI** `RetroGrid` or `Meteors` component for the ambient background to save implementation time and ensure a high-quality, performant visual effect.

**Enhancement — Mute Toggle:**
Add a small speaker icon button in the header bar to toggle audio mute/unmute for all sound effects.

**Enhancement — Magic UI Glow:**
Wrap the entire Glass Brain container in a **Magic UI** `BorderBeam` component to create a moving, high-tech border glow that signifies active processing.

---

### 4.7 Project Detail Page (Glass Brain)

**File: `app/(dashboard)/projects/[id]/page.tsx`** (NEW)

**Task:** Conditionally render the Glass Brain Dashboard or project overview based on project status.

**Key logic:**
- Server component: fetch project and slices from Supabase
- If `project.status === "building"`: render `<GlassBrainDashboard projectId={id} slices={slices} />`
- Otherwise: render project overview with title, status, confidence, "View Plan" button, "Start Build" button (when status is "ready"), and `<SliceList>`

---

### 4.8 Additional Glass Brain Enhancements

These are additional theatrical features that can be added iteratively after the core Glass Brain is working:

#### Ghost Cursor Overlay
**File: `components/ai/glass-brain/ghost-cursor.tsx`** (NEW)

**Task:** Render a translucent cursor (or dot) that moves across the Work Pane to show where the agent is "looking" or "typing". The cursor position is derived from the current event type:
- `code_write`: cursor at the end of the typing line
- `tool_call`: cursor moves to the tool icon area
- `test_run`: cursor moves to the terminal area

Use `framer-motion` `animate` to smoothly transition cursor position. Cursor should be a 12px electric-cyan circle with 50% opacity and a 20px glow.

#### Time Travel Replay Slider
**File: `components/ai/glass-brain/time-travel-slider.tsx`** (NEW)

**Task:** A timeline scrubber at the very bottom of the dashboard (below the confidence gauge) that allows replaying events from any point. Useful for demos when a judge arrives late.

**Key behavior:**
- Horizontal slider representing the full timeline of events
- Dragging the slider replays events up to that point
- Color-coded ticks on the slider: red for failures, green for passes, purple for self-heals
- Play/pause button for auto-replay at configurable speed (1x, 2x, 5x)

#### Cost Ticker
**File: `components/ai/glass-brain/cost-ticker.tsx`** (NEW)

**Task:** Small overlay showing real-time cost comparison:
```
Human dev: $4,200 (est. 28 hrs × $150/hr)
Lazarus:   $0.47   (3 API calls + compute)
Savings:   99.99%
```
The human estimate ticks up slowly (simulated), while the Lazarus cost shows actual API usage. This adds business value storytelling during demos.

#### Chaos Button
**File: `components/ai/glass-brain/chaos-button.tsx`** (NEW)

**Task:** A small, labeled button ("Inject Chaos") that judges can press during demos. When clicked:
1. Inject a deliberate test failure event into the stream
2. Watch the agent diagnose and self-heal in real-time
3. Creates an interactive moment for judges

Implementation: POST to `/api/projects/[id]/events` with a mock `test_result` fail event, which triggers the self-healing flow.

---

## Verification Checklist (Phases 1-4)

**Phase 1: ✅ COMPLETE**

- [x] Dashboard shell renders with sidebar navigation
- [x] Projects list page loads and displays cards

**Phase 2: ✅ COMPLETE**

- [x] Project creation multi-step form works end-to-end (create → upload → process → redirect to `/projects/[id]`)
- [x] File upload to Supabase Storage (presigned URL, `project_assets`)
- [x] Processing trigger queues a BullMQ job (`queueProjectProcessing`)
- [x] Worker runs Code-Synapse (Daytona or local), Right Brain (if configured), Gemini planner, inserts slices
- [x] Project detail page `/projects/[id]` shows status, confidence, slices list; "View Plan" when ready
- [x] Slice build API POST `/api/projects/[id]/slices/[sliceId]/build` (202, OpenHands when configured)
- [x] Events API: POST (callback), GET (polling with `?after=`)
- [x] MCP proxy routes for Left Brain and Right Brain
- [x] No mock or TODO data in Phase 2 implementation

**Phases 3–4: 🚧 IN PROGRESS**

- [ ] Slice dependency graph renders with React Flow (Phase 3)
- [ ] Glass Brain Dashboard renders all three panes (Phase 4)
- [ ] Real-time events stream via Supabase Realtime
- [ ] Confidence gauge animates on score changes
- [ ] Ghost Typer effect works for code_write events
- [ ] Sound effects play on key events (when unmuted)
- [ ] Glitch effect triggers on test failures
- [ ] Self-Healing Spotlight dims other panes during diagnosis

---

**End of Part 2.** Phases 5-8 continue in `docs/IMPLEMENTATION_PART3.md`.
