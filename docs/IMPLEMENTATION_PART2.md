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
| 2.7 Project Detail API | `app/api/projects/[id]/route.ts` | GET/PATCH/DELETE, ownership check |
| 2.8 Upload API | `app/api/projects/[id]/upload/route.ts` | Presigned URL, `project_assets` insert |
| 2.9 Process Trigger API | `app/api/projects/[id]/process/route.ts` | Queue `queueProjectProcessing` |
| 2.10 Slices API | `app/api/projects/[id]/slices/route.ts` | GET slices by project |
| 2.11 Slice Detail | `app/api/projects/[id]/slices/[sliceId]/route.ts` | GET single slice |
| 2.11 Slice Build | `app/api/projects/[id]/slices/[sliceId]/build/route.ts` | POST → OpenHands (202) |
| 2.12 Events API | `app/api/projects/[id]/events/route.ts` | POST callback, GET with `?after=` |
| 2.13 MCP Proxy | `app/api/mcp/left-brain/route.ts`, `right-brain/route.ts` | Forward to LEFT/RIGHT_BRAIN_MCP_URL |
| Project Detail Page | `app/(dashboard)/projects/[id]/page.tsx` | Status, confidence, slices list, View Plan when ready |
| Project Detail Actions | `components/projects/project-detail-actions.tsx` | Stop processing (when processing/building), Delete project (with confirmation) |
| Worker | `lib/queue/workers.ts` | `processProjectJob`: Daytona/local Code-Synapse, Right Brain, Gemini planner, slice insert |
| Code-Synapse runner | `lib/workspaces/code-synapse-runner.ts` | Daytona or local checkout + CLI |
| Daytona runner | `lib/daytona/runner.ts` | Create sandbox, clone, exec, preview link |
| MCP client | `lib/mcp/code-synapse-client.ts` | getFeatureMap, getSliceDependencies, getMigrationContext |
| Gemini planner | `lib/ai/gemini-planner.ts` | generateSlices(project) |
| Supabase migration | `supabase/migrations/20260208010000_create_projects_tables.sql` | projects, project_assets, vertical_slices, agent_events |
| API logging | All project API routes | `logger` from `@/lib/utils/logger`; request/response flow, no sensitive data |

---

### 2.0.3 Phase 2 Post-Completion Enhancements

**Project creation wizard:**
- GitHub URL and file uploads (videos, documents) are **optional individually**; at least one source required before submit
- Target framework: Next.js selectable; React, Vue, Angular, Svelte, Other show "Coming soon"
- Upgraded UI: stepper, glass card, framer-motion transitions, Shadcn Select for framework

**Project detail page:**
- **Stop processing:** Button visible when status is `processing` or `building`; PATCHes status to `pending`
- **Delete project:** Dropdown menu (⋯) with confirmation AlertDialog; DELETE `/api/projects/[id]` (cascades to assets, slices, events)

**Operational:**
- **Redis unavailability:** Process API returns 503 with clear message when Redis is down; project status reverted to `pending`; wizard toast shows Redis startup hint
- **Structured logging:** All project APIs log request start, auth, validation, DB operations, success/errors (no tokens, passwords, full bodies)
- **Supabase migration:** Run `pnpm migrate` to create projects tables; create `project-videos` and `project-documents` storage buckets in Supabase Dashboard

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
│     │   Name (required), description, target framework (Next.js only; others   │  │
│     │   "Coming soon")                                                        │  │
│     │   → Next                                                                │  │
│     ├─────────────────────────────────────────────────────────────────────────┤  │
│     │ Step 1: Source Code (optional)                                           │  │
│     │   GitHub URL input (validated if provided)                               │  │
│     │   → Next                                                                │  │
│     ├─────────────────────────────────────────────────────────────────────────┤  │
│     │ Step 2: Knowledge Assets (optional)                                      │  │
│     │   Video upload zone (.mp4, .mov, etc.), Document upload (.pdf, .md, .txt)│  │
│     │   At least one source required: GitHub URL OR files                      │  │
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
│     Stop processing button (when processing/building); Delete via ⋯ menu         │
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
## PHASE 3: Vertical Slice Architecture & Plan Command Center

### 3.0 Phase 3 Architecture & Implementation Status

**Status: ✅ COMPLETE** — Upgraded from basic 5-file plan view to a full interactive command center.

**Architecture:**

```
page.tsx (Server) → fetches project + slices
  └── PlanCommandCenter (Client orchestrator)
        ├── PlanStatsBar          — animated metrics strip with progress bar
        ├── PlanToolbar           — search, status filters, view toggle, sidebar toggle, "Build Next"
        ├── flex row:
        │   ├── PlanSidebar       — scrollable filtered slice list (280px, collapsible)
        │   └── Main viewport     — SliceGraph (graph view) or SliceList (list view)
        └── SliceDetailSheet      — right Sheet with tabs: Overview | Contracts | Dependencies
```

**Implementation Summary:**

| Item | File | Notes |
|------|------|-------|
| Shared types | `components/slices/plan-types.ts` | PlanView, PlanFilters, PlanState, PlanAction |
| Pure utilities | `components/slices/plan-utils.ts` | Filtering, buildable check, dependency chain, topological layout, status counts |
| State hook | `components/slices/use-plan-state.ts` | `useReducer`-based state; localStorage view persistence |
| Confidence ring | `components/slices/confidence-ring.tsx` | SVG radial progress ring with animated fill, color-tiered glow |
| Status badge | `components/slices/slice-status-badge.tsx` | Per-status icons, size prop (sm/md), colored border |
| Slice card | `components/slices/slice-card.tsx` | Glass card, confidence ring, dep count, BC/CC badges, search highlighting, selected glow |
| Stats bar | `components/slices/plan-stats-bar.tsx` | 5 animated metric cells, gradient progress bar, project header |
| Toolbar | `components/slices/plan-toolbar.tsx` | Search (debounced 200ms), status filter dropdown, view toggle, sidebar toggle, "Build Next" CTA |
| Sidebar | `components/slices/plan-sidebar.tsx` | 280px collapsible panel, ScrollArea, AnimatePresence stagger |
| Command center | `components/slices/plan-command-center.tsx` | Top-level client orchestrator composing all panels |
| Dependency graph | `components/slices/slice-graph.tsx` | Rich nodes, topological layout, MiniMap, dependency chain highlighting, arrow markers |
| Slice list | `components/slices/slice-list.tsx` | AnimatePresence stagger, selectedId + search props |
| Detail sheet | `components/slices/slice-detail-sheet.tsx` | Right Sheet, 3 tabs, JSON syntax coloring, build action, dep navigation |
| Plan page | `app/(dashboard)/projects/[id]/plan/page.tsx` | Thin server shell → `<PlanCommandCenter>` |

---

### 3.1 Foundation — Types, Utils, State Hook

**File: `components/slices/plan-types.ts`** (NEW)

**Task:** Shared types for the plan command center.

- `Slice` and `Project` re-exported from `Database["public"]["Tables"]` row types
- `PlanView`: `"graph" | "list"`
- `PlanFilters`: `{ search: string; statuses: SliceStatus[] }`
- `PlanState`: view, filters, selectedSliceId, focusedSliceId, detailOpen
- `PlanAction`: discriminated union for all reducer actions

**File: `components/slices/plan-utils.ts`** (NEW)

**Task:** Pure utility functions for plan logic.

| Function | Description |
|----------|-------------|
| `getFilteredSlices(slices, filters)` | Filters by name/description search + status array |
| `isBuildable(slice, allSlices)` | Returns true if slice is pending/selected and all deps are complete |
| `getNextBuildable(slices)` | First buildable slice by priority (lowest number first) |
| `getStatusCounts(slices)` | Returns `Record<SliceStatus, number>` |
| `getDependencyChain(sliceId, slices)` | Returns `Set<string>` with all transitive upstream + downstream IDs |
| `computeGraphLayout(slices)` | Topological layered layout using Kahn's algorithm; returns `Map<string, {x, y}>` |

**Topological layout algorithm:**
1. Build adjacency map from `slice.dependencies[]`
2. Kahn's algorithm for topological sort
3. Assign layer = longest path from root nodes
4. Within each layer, sort by priority
5. `x = layer * 300`, `y = posInLayer * 160 - (layerHeight / 2)` (centered)
6. Handle cycles: treat as same layer

**File: `components/slices/use-plan-state.ts`** (NEW)

**Task:** `useReducer`-based state management hook.

- Actions: `SET_VIEW`, `SET_FILTERS`, `SELECT_SLICE`, `CLEAR_SELECTION`, `OPEN_DETAIL`, `CLOSE_DETAIL`, `SET_FOCUSED_SLICE`
- Selecting a slice auto-opens the detail sheet
- Changing view clears focused slice
- View preference persisted to `localStorage` under `lazarus-plan-view`

---

### 3.2 Confidence Ring

**File: `components/slices/confidence-ring.tsx`** (NEW)

**Task:** SVG radial progress ring component with animated fill and color tiers.

- Props: `value` (0-100), `size` (24/32/48/64/80), `strokeWidth`, `showLabel`, `animated`
- Two `<circle>` elements: background track + foreground arc via `stroke-dasharray`/`stroke-dashoffset`
- CSS transition animates dashoffset from full → target on mount (0.8s ease-out)
- Color tiers: 0-39 error (#FF3366), 40-69 warning (#FFB800), 70-84 cyan (#00E5FF), 85-100 success (#00FF88)
- SVG glow filter matching color tier
- Respects `prefers-reduced-motion`

---

### 3.3 Slice Status Badge (Enhanced)

**File: `components/slices/slice-status-badge.tsx`** (MODIFY)

**Task:** Upgrade with per-status icons, size prop, and colored border.

**Status-to-icon mapping:**

| Status | Icon | Animation | Border |
|--------|------|-----------|--------|
| pending | `Clock` | — | muted/20 |
| selected | `Target` | — | quantum-violet/20 |
| building | `Loader2` | `animate-spin` | electric-cyan/20 |
| testing | `FlaskConical` | — | warning/20 |
| self_healing | `Heart` | `animate-pulse` | rail-purple/20 |
| complete | `CheckCircle2` | — | success/20 |
| failed | `XCircle` | — | error/20 |

- `size` prop: `"sm"` (default, compact) | `"md"` (with larger icon, for detail panel)

---

### 3.4 Slice Card (Enhanced)

**File: `components/slices/slice-card.tsx`** (MODIFY)

**Task:** Upgrade with glass styling, confidence ring, dependency indicators, and interactivity.

**Changes from original:**
- `glass-card` background with `hover:glow-purple` transition
- Layout: priority badge top-right, name + status badge left, description, bottom row = `[ConfidenceRing 24px] [dep count + GitBranch icon] [BC/CC badges] [retry count]`
- `selected` prop → `border-electric-cyan glow-cyan` when true
- `search` prop → highlight matching substring in name with `<mark>` (electric-cyan bg)
- `motion.button` wrapper with fade+slide entrance (`opacity: 0→1, y: 8→0`)
- BC badge: `bg-quantum-violet/15 text-quantum-violet`; CC badge: `bg-electric-cyan/15 text-electric-cyan`

---

### 3.5 Stats Bar

**File: `components/slices/plan-stats-bar.tsx`** (NEW)

**Task:** Horizontal glass-panel strip with animated metrics and progress bar.

**Layout:** Project name + status badge (left, border-right divider) | 5 metric cells (center) | completion % (right)

**Metric cells:**

| Metric | Icon | Color |
|--------|------|-------|
| Total | `Layers` | cloud-white |
| Complete | `CheckCircle2` | success |
| Building | `Activity` | electric-cyan |
| Ready | `Zap` | quantum-violet |
| Avg Confidence | `ConfidenceRing` (size=32) | tiered |

- Counts animate from 0 → target on mount via requestAnimationFrame with cubic ease-out (600ms)
- Bottom border: 1px gradient progress bar (`bg-automation-flow`) showing completion percentage

---

### 3.6 Toolbar

**File: `components/slices/plan-toolbar.tsx`** (NEW)

**Task:** Action bar with search, filters, view toggle, and build CTA.

**Left side:**
- Sidebar toggle button (`PanelLeftClose` / `PanelLeft` icons)
- Search `Input` with `Search` icon, debounced 200ms
- Status filter `DropdownMenu` with checkbox items per status + active filter count badge

**Right side:**
- "X of Y" count label
- View toggle: two icon buttons (`Network` / `LayoutList`), active one gets `bg-rail-purple/20 text-quantum-violet`
- "Build Next" `Button` (`bg-rail-fade text-white`, `Zap` icon, disabled when no buildable slices)

---

### 3.7 Sidebar

**File: `components/slices/plan-sidebar.tsx`** (NEW)

**Task:** Collapsible 280px panel with filtered slice cards.

- `bg-obsidian/60 backdrop-blur-sm`, `border-r border-border`
- `ScrollArea` containing filtered `SliceCard`s
- `AnimatePresence` + `motion.div` with `staggerChildren: 0.04` for card entrance
- Selected card highlighted via `selected` prop
- Collapses to 0px when sidebar toggle is off (renders `null`)

---

### 3.8 Command Center Orchestrator

**File: `components/slices/plan-command-center.tsx`** (NEW)

**Task:** Top-level client component composing all plan panels.

- Receives `project` + `initialSlices` from server page
- Instantiates `usePlanState()` for view, filters, selection state
- Computes filtered slices and buildable count via `useMemo`
- Composes: `PlanStatsBar` → `PlanToolbar` → flex(`PlanSidebar` + viewport) + `SliceDetailSheet`
- "Build Next" handler: find next buildable via `getNextBuildable()`, select it (opens detail)
- `handleSliceUpdate` for optimistic build status updates
- Wraps in `TooltipProvider` for disabled button tooltips

---

### 3.9 Dependency Graph (Enhanced)

**File: `components/slices/slice-graph.tsx`** (MODIFY — major upgrade)

**Task:** Transform from basic grid layout to a rich interactive dependency visualization.

**Rich nodes (inline, keeps nodeTypes stable):**
- Status icon (per status, spin for building)
- Slice name (truncated, `font-grotesk`)
- Confidence ring (24px, inline SVG)
- Dependency count (`GitBranch` icon)
- Left accent border matching status color
- `glass-card`-style background with backdrop-blur

**Topological layout:**
- Uses `computeGraphLayout()` from `plan-utils.ts` instead of grid
- Left-to-right flow: root nodes on left, dependents to the right
- 300px horizontal gap, 160px vertical gap, centered within layers

**Focus mode (dependency chain highlighting):**
- `focusedSliceId` prop from hover events
- Compute `getDependencyChain()` → nodes outside chain get `opacity: 0.2`, edges outside get `opacity: 0.08`
- Chain nodes maintain full opacity + enhanced glow
- 300ms CSS transition for smooth dim/highlight

**Selected state:**
- `selectedSliceId` prop → selected node gets `electric-cyan` border + cyan glow

**New features:**
- `MiniMap` from `@xyflow/react` with dark theme colors and status-colored node indicators
- Arrow markers at edge target end (`MarkerType.ArrowClosed`)
- `onNodeMouseEnter`/`Leave` callbacks for focus mode
- Enhanced edges: animated synapse particle when source is building + dimming support

---

### 3.10 Slice List (Enhanced)

**File: `components/slices/slice-list.tsx`** (MODIFY)

**Task:** Upgrade with stagger animations and prop forwarding.

- `AnimatePresence` with staggered `motion.div` wrappers (50ms delay per card)
- `selectedId` + `search` props passed through to `SliceCard`
- Slide-up entrance animation per card (`opacity: 0→1, y: 16→0`)
- Padding added for standalone viewport use

---

### 3.11 Detail Sheet

**File: `components/slices/slice-detail-sheet.tsx`** (NEW)

**Task:** Right-side `Sheet` with detailed slice information and build action.

**Width:** `sm:max-w-lg` override on `SheetContent`, `glass-panel` background

**Header area:**
- `ConfidenceRing` size=64 with animated fill
- Slice name (`font-grotesk text-xl`) + `SliceStatusBadge` size="md" + priority badge
- Full description (no truncation)

**Tabs (`Tabs` component):**

*Overview tab:*
- Modernization flags as colored chips (`Flag` icon, `quantum-violet` styling)
- Dependency summary counts (upstream + downstream)
- Retry count with `RefreshCw` icon
- Created/updated timestamps with `Calendar` icon

*Contracts tab:*
- Two sections: "Behavioral Contract" and "Code Contract"
- JSON rendered in `<pre>` with syntax coloring: keys in `text-quantum-violet`, strings in `text-electric-cyan`, numbers in `text-success`, booleans in `text-warning`
- Null state: "No contract generated" muted text

*Dependencies tab:*
- Upstream section: "This slice depends on:" → list of dep slices as clickable mini-cards with status badges
- Downstream section: "These slices depend on this:" → clickable mini-cards
- Visual connecting lines via `border-l-2 border-border pl-3` indentation
- Clicking a dependency navigates to that slice (calls `onSliceSelect`)

**Footer:**
- Status message: "All N dependencies complete" (green) or "Waiting on N dependencies" (muted)
- "Build This Slice" button (`bg-rail-fade text-white`, `Zap` icon, full width)
- Disabled with tooltip when not buildable (deps not complete, already building, already complete)
- Calls `POST /api/projects/${projectId}/slices/${sliceId}/build`
- Optimistic status update → "building"; revert on error with `toast.error()`

---

### 3.12 Plan Page (Rewritten)

**File: `app/(dashboard)/projects/[id]/plan/page.tsx`** (MODIFY)

**Task:** Thin server shell delegating to `PlanCommandCenter`.

**Key changes from original:**
- Removed inline header bar, stats computation, and direct `SliceGraph` render
- Server component still handles auth, project + slices fetching (same Supabase queries)
- Single render: `<PlanCommandCenter project={project} initialSlices={slices ?? []} />`
- Full viewport height: `h-[calc(100vh-3rem)]`

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

### 4.8 Phase 4 Upgrade: Demo-Worthy Enhancements

**Status: ✅ COMPLETE** — Transformed Glass Brain from "functional real-time monitor" → "demo-worthy showpiece."

**Architecture:**

```
GlassBrainDashboard (orchestrator)
  ├── BootSequence (enhanced: +600ms, "Materializing panes..." phase)
  ├── BreathingGlow (wrapper: dynamic boxShadow scales with confidence)
  ├── HeaderStats (replaces old header bar)
  │     ├── AgentStatusPulse (8px dot, color from latest event type)
  │     ├── AnimatedCounters × 4 (LOC, Tests, Tools, Self-Heals)
  │     ├── Project/Slice name + SliceStatusBadge
  │     ├── ElapsedTimer (lifted, ref shared with VictoryLap)
  │     └── Mute toggle
  ├── PaneConnectionLines (CSS shimmer lines at pane boundaries)
  ├── PlanPaneEnhanced (replaces PlanPane)
  │     ├── MiniProgressBar (stacked colored segments by status)
  │     ├── ActiveSliceSpotlight (cyan-bordered card, ConfidenceRing 32px, current step)
  │     ├── SliceMiniCards (compact list, ConfidenceRing 24px, sorted by priority)
  │     └── View toggle (List ↔ Graph)
  ├── WorkPaneEnhanced (replaces WorkPane)
  │     ├── SliceContextHeaders (colored dividers when slice_id changes)
  │     ├── TestResultCards (green/red compact cards for test_result events)
  │     ├── CodeBlockLabels (filename/language header above <pre>)
  │     ├── RelativeTimestamps (every 5th event or >30s gap)
  │     └── All existing: GhostTyper, highlightCode, glitch, auto-scroll, FAB
  ├── ActivityTimeline (horizontal event density strip, h-8)
  │     ├── Event ticks (color-coded, larger for test_result/self_heal)
  │     ├── Slice background bands (10% opacity)
  │     └── Hover tooltip (event type + content preview + timestamp)
  ├── ConfidenceGauge (enhanced)
  │     ├── ConfidenceSparkline (SVG polyline, gradient fill, glowing dot)
  │     ├── Milestone markers at 25%, 50%, 75%
  │     └── Score tooltip (weighted breakdown: Code Quality, Test Coverage, etc.)
  └── VictoryLap (conditional overlay, z-50)
        ├── Animated score (text-7xl, spring scale 0→1)
        ├── "TRANSMUTATION COMPLETE" title
        ├── Stats grid 2×2 (LOC, Tests, Self-Heals, Time) with animated counters
        ├── 40 particle burst (scatter from center, fade out)
        ├── "View Plan" CTA → /projects/[id]/plan
        └── Auto-dismiss 8s or click X
```

---

#### 4.8.1 `derive-stats.ts` — Foundation Utility

**File: `components/ai/glass-brain/derive-stats.ts`** (NEW — ~180 lines)

**Task:** Pure utility module (no React, no `"use client"`). Every new component imports from here.

**Exports:**

| Function | Returns | Description |
|----------|---------|-------------|
| `deriveStats(events, confidence)` | `DerivedStats` | All computed stats: LOC, tests, tools, self-heals, activity, history, events by slice |
| `getAgentStatusLabel(events)` | `string` | Human-readable status from latest event: "Writing code...", "Running tests...", "Self-healing..." |
| `getConfidenceHistory(events, initial?)` | `ConfidencePoint[]` | Walks events accumulating `confidence_delta` into `{timestamp, value}` points |
| `getConfidenceBreakdown(score)` | `ConfidenceBreakdown` | Deterministic weighted split: codeQuality (30%), testCoverage (35%), selfHealSuccess (15%), overallProgress (20%) |
| `countLinesOfCode(events)` | `number` | Sum of newlines in all `code_write` event content |
| `getTestSummary(events)` | `TestSummary` | Count `test_result` events, inspect `metadata.passed`/`metadata.result` |
| `getEventTypeColor(eventType)` | `string` | Hex color for each `AgentEventType` |
| `timeAgo(dateStr)` | `string` | "5s ago", "3m ago" — extracted from `thoughts-pane.tsx` for reuse |

---

#### 4.8.2 `styles/tailwind.css` — New Animations

**File: `styles/tailwind.css`** (MODIFY)

**Added to `@theme`:**
- `--animate-breathing-glow: breathing-glow 4s ease-in-out infinite` — `@keyframes breathing-glow` cycles `box-shadow: inset 0 0 20px rgba(0,229,255,0.03)` ↔ `inset 0 0 40px rgba(0,229,255,0.08)`

**Added to `@layer utilities`:**
- `.glow-success` — `box-shadow: 0 0 30px rgba(0,255,136,0.2)`
- `.glow-success-strong` — `box-shadow: 0 0 60px rgba(0,255,136,0.3)`

---

#### 4.8.3 `header-stats.tsx` — Rich Header Bar

**File: `components/ai/glass-brain/header-stats.tsx`** (NEW — ~190 lines)

**Props:** `events, confidence, projectName, activeSlice, muted, toggleMute, elapsedRef`

**Layout:** `[AgentStatusPulse + statusText] [LiveCounters ×4] [project/slice + Timer + Mute]`

- **AgentStatusPulse:** 8px pulsing dot (color from `getEventTypeColor()` of latest event) + `AnimatePresence` status text fade
- **LiveCounters:** 4 compact stat cells with rAF-animated numbers (same pattern as `plan-stats-bar.tsx`): Lines of Code (`Code`), Tests pass/fail (`FlaskConical`), Tools Used (`Wrench`), Self-Heals (`RotateCw` — only shown when > 0)
- **ElapsedTimer:** Moved from dashboard into this component; writes to shared `elapsedRef` for VictoryLap

---

#### 4.8.4 `confidence-sparkline.tsx` + `confidence-gauge.tsx` Modifications

**File: `components/ai/glass-brain/confidence-sparkline.tsx`** (NEW — ~100 lines)

- Pure SVG `<polyline>` plotting confidence trajectory from `ConfidencePoint[]`
- `<linearGradient>` fill below line (electric-cyan at 15% → transparent)
- Current-value dot (`r=3`) with glow filter at rightmost point
- Width 200px, height 24px (configurable via props)
- Only renders if history has ≥ 2 points

**File: `components/ai/glass-brain/confidence-gauge.tsx`** (MODIFY)

- New prop: `history?: ConfidencePoint[]`
- Sparkline inserted between label and bar (120px × 20px when history available)
- Milestone tick marks at 25%, 50%, 75% (thin `w-px bg-cloud-white/20` dividers)
- Score number wrapped in `<TooltipProvider>` → `<Tooltip>` → `<TooltipContent>` showing weighted breakdown from `getConfidenceBreakdown()`
- Layout: `[Label] [Sparkline?] [===Bar===] [Score+Tooltip]`

---

#### 4.8.5 `plan-pane-enhanced.tsx` — Enhanced Plan Pane

**File: `components/ai/glass-brain/plan-pane-enhanced.tsx`** (NEW — ~220 lines)

**Props:** `slices, activeSliceId, events`

Replaces `PlanPane` in the orchestrator.

**Sub-components:**

1. **MiniProgressBar** — horizontal stacked `motion.div` bar showing status distribution, animated width. Labels below: "X pending / Y building / Z complete"
2. **ActiveSliceSpotlight** — currently-building slice as a larger card with pulsing cyan border (`box-shadow: 0 0 12px rgba(0,229,255,0.15)`), `ConfidenceRing` (32px), name, status badge, current step from `getAgentStatusLabel(sliceEvents)`
3. **SliceMiniCard** — compact row: status color dot (2px), name (truncated), `ConfidenceRing` (24px, no label). Sorted by priority.
4. **View toggle** — `List` / `GitBranch` icon pair. Default: list. Graph renders `SliceGraph`.

**Layout:**
```
[Header: "The Plan" | X/Y | ViewToggle]
[MiniProgressBar]
---
{list: ActiveSliceSpotlight + ScrollArea of SliceMiniCards}
{graph: SliceGraph}
```

---

#### 4.8.6 `work-pane-enhanced.tsx` — Enhanced Work Pane

**File: `components/ai/glass-brain/work-pane-enhanced.tsx`** (NEW — ~340 lines)

**Props:** `events, slices`

Ports ALL existing `work-pane.tsx` code (GhostTyper, highlightCode, glitch effect, auto-scroll, FAB) and adds:

1. **Slice context headers** — when `slice_id` changes between events, inserts a colored divider: `bg-electric-cyan/5` with dot + slice name + status. Built from `slices` prop → `sliceMap`.
2. **Event group styling** — observations get `border-l-2 border-electric-cyan/15` connecting border (extends existing `ml-6`)
3. **Relative timestamps** — shown every 5th event or when >30s elapsed. `text-[9px] text-muted-foreground/40` right-aligned. Reuses `timeAgo()` from `derive-stats.ts`.
4. **Code block labels** — if `event.metadata` has `filename` or `language`, shows header above `<pre>`: `FileCode` icon + filename.
5. **Test result summary cards** — special rendering for `test_result`: compact card with green/red background tint, pass/fail icon, failure file if in metadata. `mx-3 my-1.5 rounded-md border px-3 py-2`.

---

#### 4.8.7 `activity-timeline.tsx` — Event Density Strip

**File: `components/ai/glass-brain/activity-timeline.tsx`** (NEW — ~160 lines)

**Props:** `events, slices`

**Container:** `h-8 glass-panel rounded-lg border border-border cursor-crosshair`

- Each event → thin vertical tick mark positioned by normalized timestamp. Color from `getEventTypeColor()`.
- Larger (4px wide, 0.9 opacity) dots for `test_result` and `self_heal`; 1px/0.5 opacity for others.
- Background color bands showing which slice was being worked on (6% opacity, hash-based color per slice ID).
- Hover: `onMouseMove` finds closest event within 5% threshold, shows custom tooltip with event type + content preview (80 chars) + timestamp. Tooltip positioned at mouse X.
- Empty state: "No events yet" centered text.

---

#### 4.8.8 `victory-lap.tsx` — Ship Ready Celebration

**File: `components/ai/glass-brain/victory-lap.tsx`** (NEW — ~170 lines)

**Props:** `score, stats (linesOfCode, testsPassed, testsTotal, selfHeals, elapsedSeconds), projectId, onDismiss`

**Trigger:** In orchestrator, when `confidence >= 0.85` for the first time (tracked via `useRef<boolean>(false)`).

**Rendering:**
- Backdrop: `fixed inset-0 z-50 bg-void-black/80 backdrop-blur-sm`
- Large animated score: `text-7xl font-bold text-success` with spring scale `0→1`, green text-shadow glow
- "TRANSMUTATION COMPLETE" in `font-grotesk uppercase tracking-[0.3em] text-electric-cyan`
- Stats grid (2×2): Lines of Code, Tests Passed, Self-Heals, Time Elapsed — animated counters (rAF, 1200ms cubic ease-out)
- "View Plan" CTA → `/projects/[id]/plan` with `glow-success-strong` styling
- 40 particle `motion.div` elements bursting from center (scatter to random positions over 2s, 4 colors, fade out)
- Auto-dismiss after 8s, or click X to close (exit animation 300ms)
- Respects `prefers-reduced-motion` (no particles, instant display)

---

#### 4.8.9 `ambient-effects.tsx` — Visual Polish

**File: `components/ai/glass-brain/ambient-effects.tsx`** (NEW — ~60 lines)

**PaneConnectionLines:** Two absolute-positioned `w-px` dividers at ~25% and ~75% of pane grid, `animate-shimmer bg-gradient-to-b from-transparent via-electric-cyan/20 to-transparent opacity-20`, `pointer-events-none`.

**BreathingGlow:** `motion.div` wrapper with dynamic `boxShadow` that scales with confidence (`intensity = 20 + confidence * 40`, `alpha = 0.05 + confidence * 0.1`). Animates between 50% and 100% intensity over 4s `easeInOut` infinite cycle.

---

#### 4.8.10 `glass-brain-dashboard.tsx` — Wire Everything

**File: `components/ai/glass-brain/glass-brain-dashboard.tsx`** (MODIFY — ~100 lines of changes)

**Changes from base Phase 4:**

1. Import all new components (`HeaderStats`, `PlanPaneEnhanced`, `WorkPaneEnhanced`, `ActivityTimeline`, `VictoryLap`, `PaneConnectionLines`, `BreathingGlow`, `deriveStats`, `getConfidenceHistory`)
2. Compute `stats` and `confidenceHistory` via `useMemo` using `deriveStats()` and `getConfidenceHistory()`
3. Replace header bar → `<HeaderStats>` with shared `elapsedRef`
4. Replace `<PlanPane>` → `<PlanPaneEnhanced>` (pass `events`)
5. Replace `<WorkPane>` → `<WorkPaneEnhanced>` (pass `slices`)
6. Add `<ActivityTimeline>` between panes and gauge
7. Pass `history` prop to `<ConfidenceGauge>`
8. Add `<VictoryLap>` overlay (conditional via `useRef<boolean>(false)` trigger at confidence ≥ 0.85)
9. Add `<PaneConnectionLines>` as absolute overlay in grid area
10. Wrap container in `<BreathingGlow>` div
11. Enhanced boot sequence: 5-phase (was 4): pulsing dot → radiating lines → "Neural Link Established" → "Materializing panes..." → fade out (~3.4s total, +600ms from base)
12. Pane-by-pane stagger reveal: `variants` with `custom={0|1|2}`, 150ms delay between each pane
13. Lift elapsed time into `useRef<number>(0)` for VictoryLap stats; shared via prop to `HeaderStats`

**Updated layout:**
```
[BreathingGlow wrapper]
  [HeaderStats]
  [PaneConnectionLines (absolute)]
  [PlanPaneEnhanced | WorkPaneEnhanced | ThoughtsPane]  grid-cols-[1fr_2fr_1fr]
  [ActivityTimeline]                                      h-8
  [ConfidenceGauge + Sparkline]
  [VictoryLap overlay (conditional)]
```

---

### 4.9 Additional Glass Brain Enhancements (Not Yet Implemented)

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
- [x] GitHub URL and file uploads optional; at least one source required before submit
- [x] Target framework: Next.js selectable; others show "Coming soon"
- [x] File upload to Supabase Storage (presigned URL, `project_assets`)
- [x] Processing trigger queues a BullMQ job (`queueProjectProcessing`)
- [x] Worker runs Code-Synapse (Daytona or local), Right Brain (if configured), Gemini planner, inserts slices
- [x] Project detail page `/projects/[id]` shows status, confidence, slices list; "View Plan" when ready
- [x] Project detail actions: Stop processing (when processing/building), Delete project (with confirmation)
- [x] DELETE `/api/projects/[id]` (cascades to assets, slices, events)
- [x] Slice build API POST `/api/projects/[id]/slices/[sliceId]/build` (202, OpenHands when configured)
- [x] Events API: POST (callback), GET (polling with `?after=`)
- [x] MCP proxy routes for Left Brain and Right Brain
- [x] Supabase migration for projects tables; structured API logging; Redis unavailability handling
- [x] No mock or TODO data in Phase 2 implementation

**Phase 3: ✅ COMPLETE**

- [x] Plan page loads with stats bar, toolbar, sidebar, and dependency graph
- [x] Stats bar shows 5 animated metric cells (Total, Complete, Building, Ready, Avg Confidence) with progress bar
- [x] Toolbar: debounced search filters both sidebar and graph, status filter dropdown with checkbox items
- [x] View toggle switches between graph and list views; preference persisted to localStorage
- [x] Collapsible sidebar (280px) with filtered slice cards, stagger animations, selected highlighting
- [x] Slice cards: glass styling, confidence ring (24px), dep count, BC/CC badges, search highlighting, selected glow
- [x] Status badges: per-status icons (Clock, Target, Loader2 spin, FlaskConical, Heart pulse, CheckCircle2, XCircle), size prop
- [x] Dependency graph: topological layered layout (left-to-right dependency flow), rich nodes with confidence ring + status icon + dep count + left accent border
- [x] Graph: MiniMap with status-colored nodes, arrow markers on edges, synapse pulse animation on building edges
- [x] Hovering a graph node dims unrelated nodes (opacity 0.2) and highlights full dependency chain (upstream + downstream)
- [x] Clicking a node/card opens the detail sheet; "Build Next" selects highest-priority buildable slice
- [x] Detail sheet: 3 tabs (Overview with modernization flags + dep counts, Contracts with syntax-colored JSON, Dependencies with clickable nav)
- [x] "Build This Slice" button in detail sheet: optimistic status update, POST to build API, toast feedback
- [x] Disabled build button with tooltip when deps not complete / already in progress / already complete
- [x] Confidence ring component: SVG radial progress with animated fill, 4 color tiers, respects prefers-reduced-motion
- [x] `pnpm build` passes without errors
- [x] No mock or TODO data in Phase 3 implementation

**Phase 4 (Base): ✅ COMPLETE**

- [x] Glass Brain Dashboard renders all three panes with CSS Grid `grid-cols-[1fr_2fr_1fr]`
- [x] Boot Sequence overlay: 3-phase animation (pulsing dot → radiating lines → "NEURAL LINK ESTABLISHED" → fade out, ~2.8s)
- [x] Real-time events stream via Supabase Realtime with polling fallback (1s interval, `/api/projects/[id]/events?after=`)
- [x] Confidence gauge: full-width animated bar with 4-stop gradient, "Ship Ready" threshold at 85%, glow intensification by tier
- [x] Ghost Typer effect for code_write events (15ms/char, electric-cyan block cursor, requestAnimationFrame loop)
- [x] Simple syntax highlighting in code blocks (keywords in cyan, strings in green, comments dimmed)
- [x] Sound effects via `useSoundEffects` hook (keystroke, success, error, heal, tick) with mute toggle
- [x] Glitch effect on test failures: `animate-glitch` class + red scanline overlay (motion.div traveling top-to-bottom)
- [x] Self-Healing Spotlight: dims Plan and Work panes to 0.4 opacity for 3s on self_heal event
- [x] Thoughts Pane: category detection (Planning/Implementing/Testing/Debugging/Healing), decreasing opacity cards, self-heal highlighting
- [x] Work Pane: per-event-type rendering with icons, auto-scroll with manual scroll detection + "Jump to Latest" FAB
- [x] Plan Pane: compact dependency graph header with completed/total counter, reuses SliceGraph
- [x] Header bar: project name, active slice name + status badge, elapsed timer (MM:SS), mute toggle
- [x] Elapsed Timer component tracking build duration
- [x] Event deduplication by ID across Realtime and initial fetch
- [x] Respects `prefers-reduced-motion` (boot sequence skipped)
- [x] `pnpm build` passes without errors

**Phase 4 Upgrade (Demo-Worthy Enhancements): ✅ COMPLETE**

- [x] `derive-stats.ts`: Pure utility with `deriveStats()`, `getAgentStatusLabel()`, `getConfidenceHistory()`, `getConfidenceBreakdown()`, `countLinesOfCode()`, `getTestSummary()`, `getEventTypeColor()`, `timeAgo()`
- [x] `header-stats.tsx`: Rich header replacing basic header bar — pulsing agent status dot (color from latest event), animated live counters (LOC, Tests, Tools, Self-Heals via rAF), project/slice context, shared elapsed timer ref
- [x] `confidence-sparkline.tsx`: SVG polyline confidence trajectory with gradient fill + glowing current-value dot; renders only when ≥ 2 history points
- [x] `confidence-gauge.tsx` enhanced: embedded sparkline, milestone tick marks at 25%/50%/75%, score wrapped in Tooltip with weighted confidence breakdown
- [x] `plan-pane-enhanced.tsx`: MiniProgressBar (stacked status segments), ActiveSliceSpotlight (cyan-bordered card, ConfidenceRing 32px, current step), SliceMiniCards (compact list with 24px rings), List ↔ Graph view toggle
- [x] `work-pane-enhanced.tsx`: Slice context headers on slice_id change, test result summary cards (green/red), code block labels (filename/language), relative timestamps (every 5th or >30s gap), observation group border styling — all existing features preserved
- [x] `activity-timeline.tsx`: Horizontal h-8 event density strip with color-coded ticks, larger dots for test_result/self_heal, slice background bands (6% opacity), hover tooltip with closest-event detection
- [x] `victory-lap.tsx`: Full-screen celebration at confidence ≥ 85% — animated score (spring 0→1), "TRANSMUTATION COMPLETE", 2×2 stats grid with rAF counters, 40 particle burst, "View Plan" CTA, auto-dismiss 8s
- [x] `ambient-effects.tsx`: PaneConnectionLines (shimmer dividers at pane boundaries), BreathingGlow wrapper (dynamic boxShadow scaling with confidence, 4s infinite cycle)
- [x] `glass-brain-dashboard.tsx` rewired: all new components integrated, enhanced 5-phase boot sequence (+600ms, "Materializing panes..."), pane-by-pane stagger reveal (150ms delay), VictoryLap trigger via useRef, shared elapsedRef, BreathingGlow wrapper
- [x] `styles/tailwind.css`: `breathing-glow` keyframe animation, `.glow-success` and `.glow-success-strong` utilities
- [x] No new npm dependencies added
- [x] Respects `prefers-reduced-motion` (particles skipped in VictoryLap, instant display)
- [x] `pnpm build` passes without errors (strict TS, noUncheckedIndexedAccess)

---

**End of Part 2.** Phases 5-8 continue in `docs/IMPLEMENTATION_PART3.md`.
