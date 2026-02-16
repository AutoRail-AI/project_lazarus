# Glass Brain View — Implementation Reference

A production-grade, immersive IDE-style dashboard for monitoring AI agent build pipelines in real time. Built with React 19, Framer Motion, Tailwind CSS v4, and a "Void Black + Rail Purple" glassmorphism design system.

This document captures every component, utility, hook, animation, and design token needed to replicate the Glass Brain view in another codebase.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Design System](#2-design-system)
3. [Component Reference](#3-component-reference)
4. [Data Layer](#4-data-layer)
5. [Animation Catalog](#5-animation-catalog)
6. [Replication Guide](#6-replication-guide)

---

## 1. Architecture Overview

### Component Tree

```
ProjectDetailOrchestrator          ← view state machine (derives view from project status)
└── GlassBrainDashboard            ← main dashboard shell
    ├── BootSequence               ← intro overlay (radial lines + "Neural Link Established")
    ├── BreathingGlow              ← confidence-reactive inset box-shadow wrapper
    ├── HeaderStats                ← top bar (status pulse, counters, timer, actions)
    │   ├── AnimatedCounter        ← rAF-based number animation
    │   └── ElapsedTimer           ← MM:SS wall-clock timer
    ├── WorkspaceExplorer          ← left pane — file tree with live diff annotations
    │   └── TreeNode               ← recursive folder/file renderer
    ├── Center Pane (two halves)
    │   ├── FileViewer             ← top: tabbed code editor with syntax highlighting
    │   ├── BuildConsole           ← bottom: terminal-style event log
    │   └── BrowserTestPanel       ← bottom alt: screenshot gallery + browser action log
    ├── ChatPane                   ← right pane — AI thoughts + user chat
    │   └── TypingIndicator        ← three-dot bounce animation
    ├── CostTicker                 ← bottom bar — traditional vs AI cost comparison
    │   └── AnimatedCost           ← rAF-based dollar animation
    ├── ChaosButton                ← floating FAB — injects mock self-heal events
    ├── MCPToolInspector           ← slide-over sheet — tool call details
    │   └── ToolCallCard           ← expandable card with source badges
    ├── SelfHealArc                ← 3-card overlay (Failure → Diagnosis → Resolution)
    │   ├── FlowingParticle        ← particle animation between cards
    │   └── PulsingDots            ← loading indicator
    └── VictoryLap                 ← fullscreen celebration overlay
        ├── Particles              ← 40-particle burst from center
        └── StatCounter            ← animated stat display
```

### Layout

```
┌─────────────────────────── HeaderStats ───────────────────────────┐
│ [●] Status text    │ LOC │ Tests │ Tools │ Heals │ Timer │ Actions │
├─────────────┬───────────────────────────┬─────────────────────────┤
│             │ [Editor Tabs]             │                         │
│  Workspace  │ ┌─── File Viewer ──────┐  │                         │
│  Explorer   │ │  (syntax highlighted)│  │       Chat Pane         │
│  (tree)     │ └──────────────────────┘  │   (AI thoughts +        │
│             │ [Console | Browser]       │    user messages)        │
│             │ ┌─── Build Console ────┐  │                         │
│             │ │  (terminal output)   │  │                         │
│             │ └──────────────────────┘  │                         │
├─────────────┴───────────────────────────┴─────────────────────────┤
│ [Build Complete badge]                            [CostTicker]    │
└───────────────────────────────────────────────────────────────────┘
                                                  [⚡ Chaos] (floating)
```

Grid: `grid-cols-[1fr_2fr_1fr]` with `gap-3`, `p-3`.

The center pane is a vertical flex split: editor tabs (top, conditional) + console/browser (bottom, always).

### View State Machine

The `ProjectDetailOrchestrator` derives which view to show based on project status:

| Project Status | View          | Notes                        |
|----------------|---------------|------------------------------|
| `pending`      | `overview`    | Default landing              |
| `processing`   | `analysis`    | Code analysis in progress    |
| `analyzed`     | `config`      | Interactive configuration    |
| `ready`        | `slice-review`| Review generated slices      |
| `building`     | `glass-brain` | **Active build monitoring**  |
| `complete`     | `glass-brain` | Read-only audit mode         |
| `failed`       | `slice-review` | Retry from slice review     |

Transitions use `AnimatePresence mode="wait"` with fade + scale variants.

---

## 2. Design System

### Color Tokens

```css
/* Primitives */
--color-void-black:     #0A0A0F;    /* Main background */
--color-slate-grey:     #1E1E28;    /* Card/panel base */
--color-cloud-white:    #FAFAFA;    /* Primary text */
--color-obsidian:       #050507;    /* Sidebar/deeper bg */

/* Brand */
--color-rail-purple:    #6E18B3;    /* Primary brand */
--color-quantum-violet: #8134CE;    /* Self-heal/accent */
--color-deep-purple:    #5B0B96;    /* Darker purple */
--color-electric-cyan:  #00E5FF;    /* Primary interactive */
--color-neon-blue:      #2979FF;    /* Active states */

/* Status */
--color-success:        #00FF88;    /* Pass/complete */
--color-warning:        #FFB800;    /* Tests/caution */
--color-error:          #FF3366;    /* Fail/destructive */
--color-info:           #00E5FF;    /* Same as electric-cyan */
```

### Event Type Colors

Each agent event type maps to a distinct color for pulse dots, timeline ticks, and log labels:

| Event Type          | Color     | Hex       |
|---------------------|-----------|-----------|
| `thought`           | Grey      | `#888888` |
| `tool_call`         | Cyan      | `#00E5FF` |
| `observation`       | Dark grey | `#666666` |
| `code_write`        | White     | `#FAFAFA` |
| `test_run`          | Yellow    | `#FFB800` |
| `test_result`       | Green     | `#00FF88` |
| `self_heal`         | Purple    | `#8134CE` |
| `confidence_update` | Cyan      | `#00E5FF` |
| `browser_action`    | Orange    | `#FF9500` |
| `screenshot`        | Violet    | `#AF52DE` |
| `app_start`         | Mint      | `#30D158` |

### Glassmorphism Classes

```css
.glass-panel {
  background: rgba(30, 30, 40, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(250, 250, 250, 0.08);
}

.glass-card {
  background: rgba(30, 30, 40, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(250, 250, 250, 0.05);
  transition: all 0.2s ease-in-out;
}
.glass-card:hover {
  background: rgba(30, 30, 40, 0.5);
  border-color: rgba(250, 250, 250, 0.15);
}
```

### Glow Effects

```css
.glow-purple        { box-shadow: 0 0 20px rgba(129, 52, 206, 0.2); }
.glow-purple-strong { box-shadow: 0 0 40px rgba(129, 52, 206, 0.3); }
.glow-cyan          { box-shadow: 0 0 20px rgba(0, 229, 255, 0.2); }
.glow-red           { box-shadow: 0 0 20px rgba(255, 51, 102, 0.2); }
.glow-red-strong    { box-shadow: 0 0 40px rgba(255, 51, 102, 0.3); }
.glow-success       { box-shadow: 0 0 30px rgba(0,255,136,0.2); }
.glow-success-strong{ box-shadow: 0 0 60px rgba(0,255,136,0.3); }
```

### Typography

| Utility        | Font                          | Usage                    |
|----------------|-------------------------------|--------------------------|
| `font-grotesk` | Space Grotesk                 | Headings, labels, badges |
| `font-sans`    | Inter                         | Body text                |
| `font-mono`    | JetBrains Mono / Fira Code    | Code, counters, logs     |

### Scrollbar

```css
.custom-scrollbar::-webkit-scrollbar       { width: 6px; height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track  { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.1); border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
```

---

## 3. Component Reference

### 3.1 GlassBrainDashboard (main shell)

**File:** `components/ai/glass-brain/glass-brain-dashboard.tsx`

**Props:**
```typescript
interface GlassBrainDashboardProps {
  projectId: string
  projectName: string
  slices: Slice[]
  isComplete?: boolean    // true = read-only audit mode (skip boot, no chaos button)
  onShowOverview?: () => void
}
```

**Key Behaviors:**
- **Boot sequence**: Plays on first render unless `isComplete`. 3.4s total: pulsing dot → radiating lines (6 lines, 60deg apart) → "Neural Link Established" → "Materializing panes..." → fade out
- **Pane stagger**: Three columns animate in with 0.15s delay between each (`custom` prop on motion variants)
- **Victory trigger**: When `confidence >= 0.85`, shows `VictoryLap` overlay once (never in audit mode)
- **File tabs**: IDE-style tab bar above editor, tracks open files + dirty state (warning dot)
- **Bottom tabs**: Console (always) + Browser (conditional — only when browser events exist)

**State:**
```typescript
booted: boolean              // Boot animation complete
panesVisible: boolean        // Panes should animate in
openFiles: string[]          // File paths open in editor
activeFileTab: string | null // Currently viewed file
dirtyFiles: Set<string>      // Files with unsaved changes
activeBottomTab: "console" | "browser"
mcpInspectorOpen: boolean    // MCP slide-over visible
showVictory: boolean         // Victory overlay visible
```

---

### 3.2 BootSequence

**Internal to `glass-brain-dashboard.tsx`**

Four-phase animation over ~3.4 seconds:

| Phase | Time    | Visual                                                       |
|-------|---------|--------------------------------------------------------------|
| 0     | 0ms     | Pulsing cyan dot (8px, opacity oscillates)                   |
| 1     | 500ms   | Dot grows to 16px + 6 radial lines (120px each, 60deg apart)|
| 2     | 1200ms  | "Neural Link Established" text (cyan, tracking-[0.3em])      |
| 3     | 2200ms  | "Materializing panes..." text (muted, 10px)                  |
| 4     | 2800ms  | Entire overlay fades out (500ms)                             |

Respects `prefers-reduced-motion` — skips immediately.

---

### 3.3 BreathingGlow (ambient wrapper)

**File:** `components/ai/glass-brain/ambient-effects.tsx`

Wraps the entire dashboard. Creates a pulsing inset box-shadow that intensifies with confidence score.

```typescript
interface BreathingGlowProps {
  confidence: number    // 0-1
  children: React.ReactNode
  className?: string
}
```

**Calculation:**
```typescript
const intensity = 20 + confidence * 40     // 20px at 0%, 60px at 100%
const alpha = 0.05 + confidence * 0.1      // 5% at 0%, 15% at 100%
```

**Animation:** Framer Motion `animate` with 3-keyframe array (half → full → half), 4s ease-in-out infinite loop.

---

### 3.4 HeaderStats

**File:** `components/ai/glass-brain/header-stats.tsx`

Top bar with status pulse, live counters, and action buttons.

**Layout (left → center → right):**

| Section | Contents |
|---------|----------|
| Left    | Pulsing status dot (color from last event type) + animated status label |
| Center  | LOC counter, Tests (passed/total), Tools Used, Self-Heals (conditional) |
| Right   | Project name, active slice name + badge, elapsed timer, View Plan link, Export Plan button, MCP Inspector toggle |

**Pulsing Status Dot:**
```typescript
// Inner dot: scales [1, 1.3, 1], opacity [0.7, 1, 0.7] — 1.5s repeat
// Expanding ring: scales [1, 2.5], opacity [0.4, 0] — 1.5s repeat
// Color = getEventTypeColor(lastEvent.event_type)
```

**AnimatedCounter** (used for all numeric stats):
- rAF-based interpolation, 600ms duration, cubic ease-out: `1 - (1 - progress)^3`
- Respects `prefers-reduced-motion`

**ElapsedTimer:**
- `setInterval` at 1s, formats as `MM:SS`
- Writes to `elapsedRef.current` for VictoryLap to read

**Export Plan:**
- Generates Markdown from all slices (behavioral + code contracts)
- Downloads as `{projectName}_plan.md` via Blob URL

---

### 3.5 ConfidenceGauge

**File:** `components/ai/glass-brain/confidence-gauge.tsx`

Horizontal progress bar with multi-color gradient, milestone ticks, and animated percentage.

**Gradient:** `linear-gradient(90deg, #FF3366, #FFB800, #00E5FF, #00FF88)`

**Color thresholds for the percentage number:**
| Score Range | Color   | Extra Effect                    |
|-------------|---------|---------------------------------|
| < 40%       | #FF3366 | None                            |
| 40-70%      | #FFB800 | Subtle yellow glow              |
| 70-85%      | #00E5FF | Cyan glow                       |
| >= 85%      | #00FF88 | Green glow + `animate-pulse-glow` |

**Milestones:** Tick marks at 25%, 50%, 75%. "Ship Ready" label at 85%.

**Percentage animation:** rAF, 800ms, cubic ease-out. Spring transition on key change (stiffness: 400, damping: 30).

**Tooltip breakdown (weighted from score):**
```
Code Quality:       30% weight
Test Coverage:      35% weight
Self-Heal Success:  15% weight
Overall Progress:   20% weight
```

---

### 3.6 ConfidenceSparkline

**File:** `components/ai/glass-brain/confidence-sparkline.tsx`

SVG mini chart (default 200x24px).

- **Polyline** with `stroke="#00E5FF"`, strokeWidth 1.5
- **Fill area** below the line with gradient from `#00E5FF/15%` to transparent
- **Glow filter** via `feGaussianBlur(stdDeviation=1.5)` on the line
- **Current value dot** with glow (r=4 blurred + r=3 solid)
- Timestamps auto-normalized to fit width

---

### 3.7 WorkspaceExplorer (left pane)

**File:** `components/ai/glass-brain/workspace-explorer.tsx`

Real file tree from workspace API + live annotations from `code_write` events.

**Features:**
- Fetches `/api/projects/{id}/workspace` on mount, re-fetches every 30s and 2s after new `code_write` events
- Merges API tree with event-only files (newly created files not yet in API)
- Directories sorted before files, alphabetical within each
- File icons: `.ts/.tsx/.js/.jsx` = cyan `FileCode`, `.test./.spec.` = yellow `FileCode`, else = grey `FileText`
- Recently modified files (within 10s) get a left cyan border + subtle bg highlight
- Self-heal fixes shown in quantum-violet
- `+N` line count badges on files with additions
- Auto-expands directories containing recently modified files

---

### 3.8 FileViewer (editor)

**File:** `components/ai/glass-brain/file-viewer.tsx`

Code viewer with line numbers, syntax highlighting, and inline editing.

**Syntax highlighting** (regex-based, no external lib):
- Keywords → `text-quantum-violet` (import, export, const, function, etc.)
- Strings → `text-success`
- Numbers → `text-warning/80`
- Comments → `text-muted-foreground/50 italic`
- JSX tags → `text-electric-cyan`

**Edit mode:**
- Toggle between read-only (highlighted `<pre>`) and `<textarea>`
- Save via PUT to `/api/projects/{id}/workspace/file`
- Dirty state tracked and bubbled to parent for tab dot indicator

---

### 3.9 BuildConsole (bottom center)

**File:** `components/ai/glass-brain/build-console.tsx`

Terminal-style event log with auto-scroll.

**Log line format:** `HH:MM:SS  LABEL  content`

**Event labels and colors:**
| Event Type    | Label    | Color Class               |
|---------------|----------|---------------------------|
| thought       | THINK    | text-muted-foreground     |
| tool_call     | TOOL     | text-electric-cyan        |
| observation   | OBS      | text-muted-foreground/60  |
| code_write    | WRITE    | text-foreground           |
| test_run      | TEST     | text-warning              |
| test_result   | PASS/FAIL| text-success / text-error |
| self_heal     | HEAL     | text-quantum-violet       |
| browser_action| BROWSER  | text-warning              |
| screenshot    | SNAP     | text-quantum-violet       |
| app_start     | START    | text-success              |

**Auto-scroll:** Detects manual scroll (threshold: 40px from bottom). Shows "Jump to Latest" pill when scrolled up.

---

### 3.10 BrowserTestPanel (bottom center, alt tab)

**File:** `components/ai/glass-brain/browser-test-panel.tsx`

Shows when browser events exist. Displays:
- **Screenshot gallery** from `screenshot` events
- **Browser action log** with contextual icons (navigate, click, type, assert, capture)
- **"Open App" link** from `app_start` event URL

---

### 3.11 ChatPane (right pane)

**File:** `components/ai/glass-brain/chat-pane.tsx`

Merges AI thoughts (from `thought`/`self_heal` events) with user chat messages.

**Features:**
- Messages sorted chronologically across both sources
- User messages right-aligned with cyan bubble, AI messages left-aligned with grey bubble
- Avatar icons: `Brain` (cyan) for AI, `User` (grey) for human
- Typing indicator: 3 bouncing dots (0.2s stagger)
- Auto-resize textarea, Enter to send, Shift+Enter for newline
- "Files modified" list shown on AI replies that modify workspace

---

### 3.12 CostTicker (bottom bar)

**File:** `components/ai/glass-brain/cost-ticker.tsx`

Real-time cost comparison:

```typescript
traditional = max(500, totalLinesOfCode × $3.75)   // $150/hr ÷ 40 lines/hr
lazarus     = eventCount × $0.001
savings     = ((traditional - lazarus) / traditional) × 100
```

Three sections: Traditional (strikethrough), Lazarus (cyan), Savings% (green).

Pulses when savings > 90%.

---

### 3.13 VictoryLap (overlay)

**File:** `components/ai/glass-brain/victory-lap.tsx`

Fullscreen celebration triggered when confidence reaches 85%.

**Sequence:**
1. **Particle burst**: 40 particles radiating from center (4 colors: green, cyan, purple, yellow). Random positions, staggered delays, scale [0→1→0.5], 2s duration.
2. **Score display**: Large "XX%" in `text-success` with double text-shadow glow (40px + 80px)
3. **Title**: "Transmutation Complete" in electric-cyan, tracking-[0.3em]
4. **Stats grid**: 2x2 grid with animated counters for LOC, Tests, Self-Heals, Time Elapsed
5. **CTA**: "View Plan" button with success glow

Auto-dismisses after 8 seconds.

---

### 3.14 SelfHealArc

**File:** `components/ai/glass-brain/self-heal-arc.tsx`

3-column overlay showing the self-heal lifecycle:

| Card | Color | Icon | Border/Glow |
|------|-------|------|-------------|
| Failure Detected | `rgba(255,51,102,0.08)` bg | `XCircle` (red) | `border-error/30 glow-red` |
| Root Cause Analysis | `rgba(110,24,179,0.08)` bg | `Brain` (violet) | `border-rail-purple/30` |
| Fix Applied | `rgba(0,255,136,0.08)` bg | `CheckCircle` (green) | `border-success/30 glow-success` |

**Animations:**
- Cards stagger in: 0s, 0.8s, 1.6s delay. Scale from 0.8→1 with spring.
- Flowing particles between cards: 3 particles on a horizontal line, cycling red→purple→green
- Retry progress dots: filled dots up to attempt count, max 5
- Waiting states show `PulsingDots` (3 dots, opacity oscillate with 0.2s stagger)
- Auto-dismisses 3s after resolution event arrives

---

### 3.15 MCPToolInspector (slide-over)

**File:** `components/ai/glass-brain/mcp-tool-inspector.tsx`

Right-side Sheet (w-96) showing all MCP tool calls.

**ToolCallCard features:**
- Left border color-coded by source: cyan (Code Analysis), purple (App Behaviour), grey (Built-in)
- Expandable with ChevronRight/Down toggle
- Source badge, duration display, status icon (CheckCircle/XCircle/pulsing dot)
- Expanded: shows Input/Output JSON + event content
- Success rate badge in header

---

### 3.16 ChaosButton (floating FAB)

**File:** `components/ai/glass-brain/chaos-button.tsx`

Fixed bottom-right button that injects a mock self-heal cycle for demo purposes.

**Injects 4 events with delays (0, 800ms, 1600ms, 2400ms):**
1. `test_result` (fail) — TypeError in DataGrid
2. `self_heal` — Root cause analysis
3. `code_write` — Normalize function fix
4. `test_result` (pass) — All tests passing

Uses AlertDialog for confirmation. Shakes on hover (`x: [-2, 2, -2, 0]`).

---

## 4. Data Layer

### 4.1 Agent Event Type

The core data model driving the entire dashboard:

```typescript
type AgentEventType =
  | "thought"           // AI reasoning
  | "tool_call"         // MCP tool invocation
  | "observation"       // Tool output/result
  | "code_write"        // Code generation
  | "test_run"          // Test execution started
  | "test_result"       // Test pass/fail result
  | "self_heal"         // Self-healing diagnosis
  | "confidence_update" // Explicit confidence change
  | "browser_action"    // Browser interaction
  | "screenshot"        // Screenshot capture
  | "app_start"         // Dev server started

interface AgentEvent {
  id: string
  project_id: string
  slice_id: string | null
  event_type: AgentEventType
  content: string                    // Human-readable description
  metadata: Record<string, unknown>  // Event-specific data
  confidence_delta: number | null    // Change to confidence score
  created_at: string                 // ISO timestamp
}
```

### 4.2 useAgentEvents Hook

**File:** `hooks/use-agent-events.ts`

Real-time event streaming with dual strategy:
1. **Primary**: Supabase Realtime (postgres_changes INSERT subscription)
2. **Fallback**: HTTP polling every 1 second (`/api/projects/{id}/events?after={timestamp}`)

**Returns:**
```typescript
{
  events: AgentEvent[]          // All events, deduplicated by ID
  latestThought: AgentEvent     // Most recent thought event
  confidence: number            // Accumulated 0-1 (sum of confidence_deltas)
  muted: boolean                // Sound effects muted
  toggleMute: () => void
  activeSliceId: string | null  // From most recent event with slice_id
}
```

**Sound effects** (via `useSoundEffects` hook):
- `code_write` → keystroke
- `test_result` pass → success chime, fail → error tone
- `self_heal` → heal sound
- `confidence_update`, `app_start` → confidence tick
- `browser_action` → keystroke
- `screenshot` → success

### 4.3 useProjectPolling Hook

**File:** `hooks/use-project-polling.ts`

Polls project + slice data every 3 seconds during active phases.

Active statuses: `processing`, `building`, `paused`, `failed`.

Slice fetching only when status is: `ready`, `building`, `paused`, `complete`, `failed`.

### 4.4 derive-stats.ts

**File:** `components/ai/glass-brain/derive-stats.ts`

Pure functions for statistics extraction:

```typescript
deriveStats(events, confidence) → {
  linesOfCode: number      // Sum of code_write line counts
  testsTotal: number       // Total test_result events
  testsPassed: number      // Passed tests
  testsFailed: number      // Failed tests
  toolsUsed: number        // tool_call event count
  selfHeals: number        // self_heal event count
  currentActivity: string  // Human-readable status
  confidenceHistory: ConfidencePoint[]
  eventsBySlice: Map<string, AgentEvent[]>
}

getConfidenceBreakdown(score) → {
  codeQuality: round(score × 30),
  testCoverage: round(score × 35),
  selfHealSuccess: round(score × 15),
  overallProgress: round(score × 20)
}

getAgentStatusLabel(events) → string
// Maps last event type to human-readable label:
// code_write → "Writing code..."
// test_run → "Running tests..."
// self_heal → "Self-healing..."
// tool_call → "Using {toolName}..."
// etc.
```

### 4.5 derive-build-phase.ts

**File:** `components/ai/glass-brain/derive-build-phase.ts`

Build pipeline tracking and phase derivation.

**Pipeline Steps:** `contracts → test_gen → implement → unit_test → e2e_test → visual_check → ship_ready`

**Build Phases:** `analysis → generation → testing → healing → complete`

**Key functions:**

```typescript
deriveBuildStep(events) → { step, stepStatuses }
// Tracks which pipeline step is active based on event types
// Steps progress: pending → active → complete/failed

deriveBuildPhase(events, confidence) → BuildPhase
// High-level phase from last event + confidence

deriveActiveBrain(events) → "left" | "right" | "agent" | "idle"
// Which brain is active based on tool_call metadata

groupSelfHealCycles(events) → SelfHealCycle[]
// Groups: test failure → self_heal diagnosis → code_write fix → test pass

extractMCPToolCalls(events) → MCPToolCall[]
// Filters tool_call events, categorizes source, tracks status

estimateCost(events) → { traditional, lazarus, savingsPercent }
// traditional = max(500, LOC × $3.75)
// lazarus = eventCount × $0.001
```

---

## 5. Animation Catalog

### CSS Keyframes (defined in `@theme`)

```css
@keyframes particle-flow {
  0%   { transform: translateX(0); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(var(--flow-distance, 100px)); opacity: 0; }
}

@keyframes breathing-glow {
  0%, 100% { box-shadow: inset 0 0 20px rgba(0,229,255,0.03); }
  50%      { box-shadow: inset 0 0 40px rgba(0,229,255,0.08); }
}

@keyframes shimmer {
  from { background-position: 0 0; }
  to   { background-position: -200% 0; }
}

@keyframes glitch {
  0%   { transform: translateX(0); opacity: 1; }
  15%  { transform: translateX(-2px); opacity: 0.85; }
  30%  { transform: translateX(2px); opacity: 0.9; }
  45%  { transform: translateX(-1px); opacity: 0.95; }
  60%  { transform: translateX(1px); }
  100% { transform: translateX(0); opacity: 1; }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-10px); }
}

@keyframes fade-in     { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up    { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
```

### Framer Motion Patterns

| Pattern | Used In | Config |
|---------|---------|--------|
| **Pane stagger** | Dashboard panes | `delay: i * 0.15`, `y: 20→0`, 0.4s ease-out |
| **Status pulse** | Header dot | `scale: [1, 1.3, 1]`, `opacity: [0.7, 1, 0.7]`, 1.5s repeat |
| **Expanding ring** | Header dot | `scale: [1, 2.5]`, `opacity: [0.4, 0]`, 1.5s repeat |
| **Text slide** | Status label | `y: 6→0` enter, `y: 0→-6` exit, 0.2s |
| **Score spring** | Confidence % | `scale: [1.2→1]` enter, spring(400, 30) |
| **Card scale-in** | Self-heal cards | `scale: 0.8→1`, spring, stagger 0.8s |
| **Particle burst** | Victory lap | Random x/y offsets, `opacity: [1,1,0]`, `scale: [0,1,0.5]` |
| **Bounce dots** | Typing indicator | `opacity: [0.3, 1, 0.3]`, 1s repeat, 0.2s stagger |
| **Flowing particles** | Self-heal arc | `left: 0%→100%`, color gradient, 2s linear repeat |
| **Fade + scale** | View transitions | `opacity: 0→1`, `scale: 0.98→1` enter |
| **Shake** | Chaos button | `x: [-2, 2, -2, 0]`, 0.3s on hover |

### rAF Counter Pattern (reused in 4+ components)

```typescript
function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value)
      prevRef.current = value
      return
    }

    const start = prevRef.current
    const diff = value - start
    if (diff === 0) return

    const duration = 600
    const startTime = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)  // cubic ease-out
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) requestAnimationFrame(animate)
      else prevRef.current = value
    }

    requestAnimationFrame(animate)
  }, [value])

  return <span>{display}</span>
}
```

### Reduced Motion Support

All components check `prefers-reduced-motion`:
- CSS animations: `duration: 0.01ms !important`
- Framer Motion: Skip animation, set final state immediately
- rAF counters: Set value directly without interpolation

---

## 6. Replication Guide

### Dependencies

```json
{
  "framer-motion": "^11.x",
  "lucide-react": "^0.4x",
  "@radix-ui/react-tooltip": "^1.x",
  "@radix-ui/react-dialog": "^1.x",
  "@radix-ui/react-scroll-area": "^1.x",
  "tailwindcss": "^4.x",
  "class-variance-authority": "^0.7",
  "tailwind-merge": "^2.x",
  "clsx": "^2.x",
  "sonner": "^1.x"
}
```

### Minimum Viable Setup

To replicate the Glass Brain as a standalone build dashboard:

1. **Design System** — Copy the `@theme` block from `styles/tailwind.css` (color tokens, animations, keyframes) and the `@layer utilities` block (glass-panel, glow effects, scrollbar)

2. **Data Model** — Define your `AgentEvent` type with at minimum: `id`, `event_type`, `content`, `metadata`, `confidence_delta`, `created_at`

3. **Event Hook** — Implement polling or WebSocket-based event streaming. The hook must return `events[]`, `confidence` (accumulated), and `activeSliceId`

4. **Core Components (in order of importance):**
    - `BreathingGlow` — 60 lines, the signature ambient effect
    - `BuildConsole` — Terminal log, most immediately useful
    - `HeaderStats` + `AnimatedCounter` — Live stat bar
    - `ConfidenceGauge` — Progress visualization
    - `WorkspaceExplorer` — File tree (needs workspace API)
    - `VictoryLap` — Celebration overlay
    - `SelfHealArc` — Self-heal visualization
    - `CostTicker` — Cost comparison
    - `ChatPane` — AI thought stream
    - `MCPToolInspector` — Tool call details

5. **Shell** — The `GlassBrainDashboard` itself is ~240 lines of layout orchestration. The three-column grid, tab management, and boot sequence.

### File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `glass-brain-dashboard.tsx` | ~500 | Main shell + boot sequence |
| `header-stats.tsx` | ~360 | Top stats bar |
| `confidence-gauge.tsx` | ~190 | Progress bar |
| `confidence-sparkline.tsx` | ~100 | SVG mini chart |
| `workspace-explorer.tsx` | ~490 | File tree |
| `file-viewer.tsx` | ~295 | Code editor |
| `build-console.tsx` | ~195 | Terminal log |
| `browser-test-panel.tsx` | ~170 | Browser testing |
| `chat-pane.tsx` | ~295 | Chat interface |
| `cost-ticker.tsx` | ~130 | Cost comparison |
| `victory-lap.tsx` | ~240 | Celebration overlay |
| `self-heal-arc.tsx` | ~215 | Self-heal cards |
| `mcp-tool-inspector.tsx` | ~200 | Tool call inspector |
| `chaos-button.tsx` | ~130 | Demo chaos injection |
| `ambient-effects.tsx` | ~60 | BreathingGlow + PaneConnectionLines |
| `derive-stats.ts` | ~230 | Statistics calculation |
| `derive-build-phase.ts` | ~320 | Pipeline phase tracking |
| **Total** | **~4,120** | |

### Hooks

| File | Lines | Purpose |
|------|-------|---------|
| `use-agent-events.ts` | ~225 | Event streaming (Supabase Realtime + polling) |
| `use-project-polling.ts` | ~100 | Project/slice data polling |

### Key Design Decisions

1. **No external charting library** — Sparklines are hand-rolled SVG (~100 lines). This eliminates heavy deps like recharts/d3.
2. **No syntax highlighting library** — Regex-based tokenization (~80 lines). Good enough for display, avoids shipping Prism/Shiki.
3. **All counters use rAF** — Not CSS transitions on `width`/`transform`. This gives smooth, jank-free number animations at 60fps.
4. **Glass morphism via utility classes** — `.glass-panel` and `.glass-card` are reusable everywhere. No inline backdrop-filter.
5. **Event-driven architecture** — Every visual change traces back to an `AgentEvent`. No polling for UI state.
6. **Sound as optional layer** — Sounds are togglable and map 1:1 to event types. Easy to strip out.
7. **Reduced motion everywhere** — Every animation has a `prefers-reduced-motion` escape hatch.
