# Phase 2: Left Brain (Code-Synapse) Integration Plan

> **Architecture Shift:** The Left Brain is not a remote HTTP server that accepts `parse_repo`. It is **Code-Synapse CLI** — a local tool that must run **inside the folder containing the checked-out GitHub repo**, takes its own time to index and justify, and produces an **MCP server** that we query for code analysis. **We must wait for CLI processing to complete before generating the architecture (vertical slices).**

---

## Executive Summary

| Current Assumption (Phase 2/5) | Actual Architecture |
|-------------------------------|---------------------|
| `LEFT_BRAIN_MCP_URL` → POST `parse_repo` with GitHub URL | Code-Synapse is a CLI run **in the repo folder** |
| Server parses repo and returns immediately | CLI: init → index → justify (LLM) → **takes time** → MCP server live |
| One-shot HTTP call | Multi-step: clone → run CLI → wait → query MCP tools |

**Code-Synapse outputs:**
- MCP server (default port 3100) with 36+ tools
- Web Viewer (default 3101) with REST API for exploration
- Knowledge graph (CozoDB) — functions, classes, call graph, business justifications

**Lazarus Migration–specific MCP tools:** `get_feature_map`, `get_migration_context`, `get_slice_dependencies`, `get_migration_progress`, `get_entity_source`, `analyze_blast_radius`, etc.

---

## Correct Processing Flow (Updated)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PROJECT PROCESSING (Left Brain First)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. USER CREATES PROJECT (GitHub URL + Knowledge Assets)                         │
│     → POST /api/projects                                                         │
│     → Upload files to Supabase Storage                                           │
│     → POST /api/projects/[id]/process                                            │
│                                                                                  │
│  2. WORKER PICKS UP JOB                                                          │
│     → Insert "thought": "Beginning project analysis..."                          │
│     → project.left_brain_status = "processing"                                   │
│                                                                                  │
│  3. CHECKOUT REPO (if githubUrl provided)                                        │
│     → Daytona: sandbox.git.clone(githubUrl, "workspace/repo")                    │
│     → Or temp dir: git clone {githubUrl} {workspacePath}                         │
│                                                                                  │
│  4. RUN CODE-SYNAPSE CLI (BLOCKING until complete)                               │
│     → cd {workspacePath}                                                         │
│     → code-synapse init        (if needed)                                       │
│     → code-synapse index       ← SCAN, PARSE, EXTRACT (Tree-sitter, CozoDB)      │
│     → code-synapse justify     ← LLM inference (business purpose) — SLOW         │
│     → code-synapse start --port {port}  ← MCP server now live                    │
│                                                                                  │
│  5. QUERY MCP FOR CODE ANALYSIS (only after step 4 completes)                    │
│     → Daytona: get preview URL for port 3100 → Code-Synapse MCP endpoint         │
│     → get_feature_map(includeEntities: true)  → features, entity breakdown       │
│     → get_slice_dependencies()                 → inter-feature deps, topo order  │
│     → get_migration_context(featureContext)    → per-feature code contracts      │
│     → Store in project.metadata.code_analysis, project.metadata.daytona_sandbox_id│
│                                                                                  │
│  6. RIGHT BRAIN (if configured)                                                  │
│     → Fetch project_assets from Supabase                                         │
│     → POST to RIGHT_BRAIN_MCP_URL with extract_behaviors                         │
│                                                                                  │
│  7. GENERATE VERTICAL SLICES                                                     │
│     → generateSlices(project) from lib/ai/gemini-planner                         │
│     → Input: metadata.code_analysis + metadata.behavioral_analysis               │
│     → Insert into vertical_slices table                                          │
│                                                                                  │
│  8. project.status = "ready", project.left_brain_status = "complete"             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Code-Synapse CLI Reference

**Default command** (runs all steps, keeps server up):
```bash
cd /path/to/repo
code-synapse   # init → index → justify → viewer + MCP server
```

**Phased commands** (for our pipeline — we need to control each step):
```bash
code-synapse init              # Initialize config only
code-synapse index             # Build knowledge graph (exits when done)
code-synapse justify           # LLM business justification (exits when done)
code-synapse start --port 3100 # Start MCP server (stays running)
```

**Options:**
- `--skip-justify` — Skip LLM (faster, but no business context)
- `--justify-only` — Re-run justification only (assumes already indexed)
- `-m balanced` — Model preset (fastest/minimal/balanced/quality/maximum)

**MCP server:** `http://localhost:3100/mcp` (HTTP transport)

---

## MCP Tools to Use (Code-Synapse API Spec)

| MCP Tool | Purpose for Lazarus | Output |
|----------|---------------------|--------|
| `get_feature_map` | List features/domains, entity counts | Features with entity lists |
| `get_slice_dependencies` | Inter-feature dependency order for migration | Topological execution order |
| `get_migration_context` | Build code contract for a feature slice | Entities, deps, business rules, patterns |
| `get_entity_source` | Get source code of an entity | For code contracts |
| `search_code` | Search entities by name/pattern | Discovery |
| `get_project_stats` | Overview (files, functions, classes) | Stats for UI |

**Example `get_migration_context` response** (from API_SPEC.md):
```json
{
  "entities": [...],
  "internalDependencies": [...],
  "externalDependencies": [...],
  "businessRules": [...],
  "patterns": [...],
  "stats": { "entityCount": 8, "fileCount": 3, ... }
}
```

This maps directly to the **Code Contract** in our vertical slice schema.

---

## Workspace Strategy: Checkout + CLI

### Option A: Daytona Sandboxes (Recommended)

**Why Daytona:**
- **Process persistence:** Runs on Daytona's remote/cloud infrastructure — laptop sleep, battery death, or closing the lid does not kill the Code-Synapse process.
- **Isolation:** One sandbox per project; reproducible dev envs.
- **Preview URLs:** Daytona exposes ports via preview links — our worker queries the Code-Synapse MCP server at `https://3100-{sandboxId}.{daytonaProxyDomain}/mcp`.

**Critical config:** Set `autoStopInterval: 0` when creating the sandbox. Daytona's default 15-minute inactivity timer triggers even when background processes (e.g. `code-synapse index`, `code-synapse justify`) are running — they do NOT count as "activity." Without `autoStopInterval: 0`, the sandbox can auto-stop mid-process.

**Daytona MCP Server** ([docs](https://www.daytona.io/docs/en/mcp)) exposes tools we can use:

| MCP Tool | Purpose for Lazarus |
|----------|---------------------|
| `create_sandbox` | Create sandbox with `auto_stop_interval: "0"`, `language: "javascript"` |
| `execute_command` | Run `code-synapse index`, `code-synapse justify`, `code-synapse start --port 3100` |
| `git_clone` | Clone GitHub repo into sandbox |
| `preview_link` | Get URL for Code-Synapse MCP port (3100) to query from our worker |
| `destroy_sandbox` | Cleanup when project deleted |

**Daytona TypeScript SDK** ([docs](https://www.daytona.io/docs/en/typescript-sdk/)):

```typescript
import { Daytona } from "@daytonaio/sdk"

const daytona = new Daytona({ apiKey, apiUrl, target: "us" })

// Create sandbox — MUST set autoStopInterval: 0 for long-running Code-Synapse
const sandbox = await daytona.create({
  language: "javascript",
  autoStopInterval: 0,
  resources: { cpu: 2, memory: 4, disk: 8 },
})

// Clone repo
await sandbox.git.clone(githubUrl, "workspace/repo")

// Run Code-Synapse (blocking)
await sandbox.process.executeCommand("code-synapse index", "workspace/repo")
await sandbox.process.executeCommand("code-synapse justify", "workspace/repo")

// Start MCP server in background session
await sandbox.process.createSession("code-synapse-mcp")
await sandbox.process.executeSessionCommand("code-synapse-mcp", {
  command: "code-synapse start --port 3100",
  runAsync: true,
})

// Get preview URL for port 3100 — use this to query Code-Synapse MCP
const previewInfo = await sandbox.getPreviewLink(3100)
// previewInfo.url → https://3100-{sandboxId}.{daytonaProxyDomain}
// previewInfo.token → for x-daytona-preview-token header (if sandbox not public)
```

**Flow:**
1. Create Daytona sandbox with `autoStopInterval: 0`
2. `sandbox.git.clone(githubUrl, "workspace/repo")`
3. `sandbox.process.executeCommand("code-synapse index", "workspace/repo")` — wait
4. `sandbox.process.executeCommand("code-synapse justify", "workspace/repo")` — wait
5. Start `code-synapse start --port 3100` in background session
6. Get preview URL for port 3100
7. Query Code-Synapse MCP at preview URL (`get_feature_map`, `get_slice_dependencies`, etc.)
8. Store `project.metadata.code_analysis` and `project.metadata.daytona_sandbox_id` for OpenHands
9. Keep sandbox alive for OpenHands agent; optionally archive/destroy when project deleted

**Environment:** `DAYTONA_API_KEY`, `DAYTONA_API_URL`

**Pros:** Process survives laptop issues, isolation, preview URLs for MCP queries  
**Cons:** Daytona account, SDK/API setup

---

### Option B: Simple Temp Directory (Fallback)

**Flow:**
1. Create temp dir: `{WORKSPACES_ROOT}/{projectId}/repo` or OS temp
2. `git clone {githubUrl} {dir}` (or shallow: `--depth 1`)
3. Spawn `code-synapse index` → wait for exit
4. Spawn `code-synapse justify` → wait for exit
5. Spawn `code-synapse start --port {dynamicPort}` in background
6. Query MCP over HTTP
7. Store results, optionally keep MCP server running for OpenHands agent
8. Cleanup temp dir when project deleted (or retain for cache)

**Pros:** No external tools, straightforward  
**Cons:** Laptop sleep kills process, temp dir management, no isolation

---

### Option C: Docker Compose (Lazarus-Specific)

Define a `code-synapse-runner` service:
- Volume: `./workspaces/{projectId}:/workspace`
- Entrypoint: clone repo into /workspace, run code-synapse
- Expose MCP port
- Next.js worker triggers via Docker API or queue

**Pros:** Isolated, matches Docker-based deployment  
**Cons:** Docker dependency, slower cold start

---

**Recommendation:** Use **Option A (Daytona)** for production — process persists on remote infrastructure. Use **Option B (temp dir)** as fallback when Daytona is not configured.

---

## Integration Points with Phase 2

### 1. Project Creation Form
- User provides GitHub URL (optional, validated if provided) and/or uploads videos/documents
- At least one source required: GitHub URL or files
- POST /api/projects, upload (if files), POST /process

### 2. Worker: `processProjectJob` (major update)

**Replace:**
```txt
POST to LEFT_BRAIN_MCP_URL with parse_repo
```

**With:**
```txt
1. git clone {githubUrl} {workspacePath}
2. execSync/spawn: code-synapse index (cwd: workspacePath) — wait
3. execSync/spawn: code-synapse justify (cwd: workspacePath) — wait
4. spawn: code-synapse start --port {port} — background
5. MCP HTTP client: call get_feature_map, get_slice_dependencies
6. For each feature: get_migration_context(featureContext)
7. project.metadata.code_analysis = { features, sliceDeps, migrationContexts }
8. Continue to Right Brain, then Gemini planner
```

### 3. MCP HTTP Client

Code-Synapse MCP uses stdio by default; for HTTP:
```bash
code-synapse start --port 3100
# Then: POST http://localhost:3100/mcp with MCP JSON-RPC
```

We need a small **MCP HTTP client** in `lib/mcp/code-synapse-client.ts`:
- `callTool(toolName, params)` → MCP JSON-RPC over HTTP
- Used by worker and (later) OpenHands agent

### 4. OpenHands Agent (Phase 5)

OpenHands needs the **same MCP server** throughout development:
- When building a slice, agent calls `get_migration_context`, `get_entity_source`, etc.
- MCP server must stay alive for the project's workspace
- Store `LEFT_BRAIN_MCP_URL` per project: `http://host:port/mcp` where port is the one we started for that project

**Persistence:** Either keep `code-synapse start` running per project, or re-start it on demand when OpenHands needs it (slower, but simpler).

---

## Operational Requirements (Phase 2 Infrastructure)

**Redis:** Required for BullMQ job queues. Start with `docker run -d -p 6379:6379 redis:7-alpine` or use Docker Compose. If Redis is unavailable, the process API returns 503 with a clear message; project status is reverted to `pending`.

**Supabase migration:** Run `pnpm migrate` to create `projects`, `project_assets`, `vertical_slices`, and `agent_events` tables. Create `project-videos` and `project-documents` storage buckets in the Supabase Dashboard for file uploads.

**Project creation:** GitHub URL and file uploads are optional individually; at least one source is required. Target framework: Next.js is selectable; others show "Coming soon."

**Project detail actions:** Stop processing (when status is `processing` or `building`) and Delete project (with confirmation) are available on the project detail page.

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Redis connection (default: `redis://localhost:6379`); required for BullMQ job queues |
| `DAYTONA_API_KEY` | API key for Daytona (required if using Daytona) |
| `DAYTONA_API_URL` | Daytona API URL (default: `https://app.daytona.io/api`) |
| `CODE_SYNAPSE_CLI_PATH` | Path to `code-synapse` binary (default: `code-synapse` from PATH) |
| `WORKSPACES_ROOT` | Base path for cloned repos when NOT using Daytona (default: `./workspaces` or OS temp) |
| `LEFT_BRAIN_MCP_URL` | (Optional) Pre-running MCP server for development; if set, skip clone+CLI and use this URL |
| `CODE_SYNAPSE_SKIP_JUSTIFY` | Set to `true` to skip LLM justification (faster indexing) |

---

## Order of Operations (Critical)

**We must NOT generate vertical slices until Code-Synapse has finished:**

1. ✅ Checkout repo
2. ✅ Run `code-synapse index` → wait for completion
3. ✅ Run `code-synapse justify` → wait for completion
4. ✅ Start MCP server
5. ✅ Query `get_feature_map`, `get_slice_dependencies`, `get_migration_context`
6. ✅ Store `project.metadata.code_analysis`
7. ✅ (Optional) Right Brain analysis
8. ✅ **Only then** call `generateSlices(project)` with full analysis

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/mcp/code-synapse-client.ts` | NEW — MCP HTTP client for Code-Synapse |
| `lib/daytona/runner.ts` | NEW — Daytona sandbox orchestration (create, clone, exec, preview URL) |
| `lib/workspaces/checkout.ts` | NEW — Git clone to workspace (fallback when not using Daytona) |
| `lib/workspaces/code-synapse-runner.ts` | NEW — Run CLI, wait, start MCP (abstracts Daytona vs temp dir) |
| `lib/queue/workers.ts` | MODIFY — Replace parse_repo with new flow; use Daytona when configured |
| `docs/IMPLEMENTATION_PART3.md` | MODIFY — Update processProjectJob flow |
| `env.mjs` | MODIFY — Add DAYTONA_*, CODE_SYNAPSE_*, WORKSPACES_ROOT |
| `.env.example` | MODIFY — Document new vars |
| `package.json` | MODIFY — Add `@daytonaio/sdk` when using Daytona |

---

## Reference

- **Code-Synapse README:** `/Users/jaswanth/IdeaProjects/code-synapse/README.md`
- **Code-Synapse API Spec:** `/Users/jaswanth/IdeaProjects/code-synapse/docs/API_SPEC.md`
- **Lazarus Migration MCP Tools:** API_SPEC.md §8 (get_entity_source, get_feature_map, get_migration_context, get_slice_dependencies, etc.)
- **Daytona MCP Server:** [https://www.daytona.io/docs/en/mcp](https://www.daytona.io/docs/en/mcp) — create_sandbox, execute_command, git_clone, preview_link, destroy_sandbox
- **Daytona TypeScript SDK:** [https://www.daytona.io/docs/en/typescript-sdk/](https://www.daytona.io/docs/en/typescript-sdk/) — Daytona.create(), sandbox.process.executeCommand(), sandbox.git.clone()
- **Daytona Process & Code Execution:** [https://www.daytona.io/docs/en/process-code-execution](https://www.daytona.io/docs/en/process-code-execution) — Sessions for background processes
- **Daytona Sandbox Management:** [https://www.daytona.io/docs/en/sandbox-management](https://www.daytona.io/docs/en/sandbox-management) — autoStopInterval: 0 for long-running tasks
- **Daytona Preview & Authentication:** [https://www.daytona.io/docs/en/preview-and-authentication](https://www.daytona.io/docs/en/preview-and-authentication) — getPreviewLink(port), token for `x-daytona-preview-token`
