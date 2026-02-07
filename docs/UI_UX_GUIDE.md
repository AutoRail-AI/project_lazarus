# UI/UX Reference Guide
## Complete Design System & Implementation Standards

**Version:** 4.0  
**Status:** Authoritative Reference  
**Target Quality:** Enterprise SaaS (Stripe, Linear, Atlassian, Notion)  
**Last Updated:** February 2026  
**Component Library:** Shadcn UI (438+ components available)  
**Product:** Project Lazarus — The Legacy Code Necromancer

---

## Executive Summary

This document serves as the **single source of truth** for all UI/UX decisions, design system standards, and component usage across **Project Lazarus**. It applies to all features including:

- **Glass Brain Dashboard** — The Lazarus HUD (Plan, Work, Thoughts panes)
- **Migration Plan View** — Vertical slices, dependency graph, slice status
- **Thought Signatures** — Agent reasoning and inner monologue display
- **Confidence Gauge** — Live confidence scoring and self-healing status
- **Projects** — Project creation, upload, and migration management
- **Settings** — Profile, authentication, preferences

It consolidates:
- Enterprise UX transformation guidelines
- Visual design system specifications
- Component patterns and usage for all features
- Project Lazarus–specific UI patterns (Glass Brain, migration visualization)
- Shadcn UI component references
- Quality standards and validation checklists

**Component Library:** Built with **Shadcn UI** — 438+ components available via MCP server. All components are copy-paste ready and customizable.

**Reference Standards:**
- Stripe Dashboard (clean, minimal, high information density)
- Linear (fast, predictable, delightful micro-interactions)
- Atlassian (comprehensive, scalable, enterprise-ready)
- Notion (flexible, powerful, approachable)

---

## Table of Contents

1. [Foundation & Architecture](#part-i-foundation--architecture)
2. [Design System](#part-ii-design-system)
3. [Shadcn UI Components](#part-iii-shadcn-ui-components)
4. [Component Patterns](#part-iv-component-patterns)
5. [Project Lazarus UI](#part-v-project-lazarus-ui)
   - Glass Brain Dashboard
   - Migration Plan View
   - Thought Signatures
   - Confidence Gauge
   - Projects
   - Settings
   - Theatrical Elements
6. [Quality Standards](#part-vi-quality-standards)
7. [Reference Checklists](#part-vii-reference-checklists)

---

## Part I: Foundation & Architecture

### 1.1 Account Model

**Principle:** Users sign up and authenticate via Better Auth. Projects are scoped to users and optionally to organizations.

**Navigation Structure:**
- **Projects** — List of migration projects, create new project
- **Project Detail** — Glass Brain Dashboard for a single migration
- **Settings** — Profile, authentication, preferences

---

### 1.2 Authorization

**Roles (when organization plugin is used):**

| Role | Capabilities |
|------|--------------|
| `owner` | Full project and organization control |
| `admin` | Member management, settings (except deletion) |
| `member` | Create and manage assigned projects |
| `viewer` | View projects and migration status |

---

### 1.3 Settings Architecture

**User-Level Settings:**
- Profile — Name, email, avatar
- Authentication — Password, OAuth connections
- Preferences — Theme, language, notifications

---

## Part II: Design System

### 2.1 Typography Hierarchy & Legibility

**Core Principle:** We do not mute primary content text. All primary content must be clearly legible and use high-contrast colors. We use **Inter** with specific feature settings for an enterprise look, **Space Grotesk** for technical headings, and **JetBrains Mono** for code.

#### Typography Scale

| Element | Size | Weight | Font | Usage |
|---------|------|--------|------|-------|
| **Page Title** | `text-lg` (18px) | `font-semibold` (600) | Space Grotesk | Main page headings |
| **Section Header** | `text-sm` (14px) | `font-semibold` (600) | Space Grotesk | Major sections |
| **Body Text** | `text-sm` (14px) | `font-normal` (400) | Inter | Primary content |
| **Code/Terminal** | `text-xs` (12px) | `font-normal` (400) | JetBrains Mono | Logs, code streams |
| **Form Label** | `text-xs` (12px) | `font-normal` (400) | Inter | Field labels |

#### Font Feature Settings
For **Inter**, we enable:
- `cv02` (Curved r)
- `cv03` (Curved y)
- `cv04` (Open 4)
- `cv11` (Single-story a)

This creates a more technical, precise, and enterprise-grade appearance.

#### Typography Legibility Rules
**MANDATORY:**
- All primary content must use `text-foreground` (Cloud White).
- Muted text (`text-muted-foreground`) is ONLY for metadata, placeholders, and labels.
- Never use `text-gray-500` directly; use semantic tokens.

---

### 2.2 Spacing Scale

**Core Principle:** Strict 4px grid. All spacing must be a multiple of 4px.

#### Container Spacing
- Page container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Section spacing: `space-y-6` (24px)
- Card padding: `p-6` (24px)

#### Component Spacing
- Form fields: `space-y-4` (16px)
- Button groups: `gap-2` (8px)
- List items: `space-y-1` (4px)
- Icon + text: `gap-2` (8px)

---

### 2.3 Color System

**Theme:** Void Black + Rail Purple (Glass Brain Aesthetic)

#### Semantic Colors

| Color | Usage | Hex Value |
|-------|-------|-----------|
| **Background** | App background | `#0A0A0F` (Void Black) |
| **Card** | Glass panels | `rgba(30, 30, 40, 0.4)` |
| **Primary** | Actions, highlights | `#6E18B3` (Rail Purple) |
| **Accent** | Active states, glow | `#00E5FF` (Electric Cyan) |
| **Border** | Subtle separation | `rgba(250, 250, 250, 0.1)` |

#### Glassmorphism Utilities
- `.glass-panel`: Standard glass background with blur.
- `.glass-card`: Interactive glass card with hover effect.
- `.border-gradient`: Gradient border for high-value items.

---

### 2.4 Motion Design

**Core Principle:** Motion should be purposeful, smooth, and "theatrical" for the Glass Brain.

#### Standard Animations
- **Fade In:** `animate-fade-in` (0.5s ease-out)
- **Slide Up:** `animate-slide-up` (0.5s ease-out)
- **Pulse Glow:** `animate-pulse-glow` (2s infinite) - for "thinking" states.
- **Shimmer:** `animate-shimmer` (2s linear) - for loading/processing.

#### Theatrical Effects
- **Thought Appearance:** Staggered slide-in for thought signatures.
- **Confidence Jitter:** Smooth transition for the gauge.
- **Code Streaming:** Auto-scroll with typing effect.

---

### 2.5 Component Patterns

#### Cards
- Background: `bg-muted/30` (not white)
- Padding: `pt-6` via `CardContent` (never full padding)
- Structure: Prefer `Card` + `CardContent` over `CardHeader` + `CardContent`
- Headers: Inline with `text-sm font-semibold` instead of `CardTitle`
- No heavy borders or shadows

**Shadcn Component:** `@shadcn/card`

#### Buttons
- Primary: Solid background, high contrast (`size="sm"` for app)
- Secondary: Outlined variant (`size="sm"`)
- Destructive: Red variant for dangerous actions
- Sizes: `sm` (default in app), `default`, `lg` (only for empty states)
- Loading: Use `Spinner` from `@shadcn/spinner`, not `Loader2`

**Shadcn Component:** `@shadcn/button`

#### Forms
- Label: `text-xs text-muted-foreground`
- Input: `h-9` height (never default or `h-10`)
- Textarea: `text-sm` with proper rows
- Error: Red border + error message below
- Help text: `text-xs text-foreground` (NOT muted)

**Shadcn Components:** `@shadcn/input`, `@shadcn/label`, `@shadcn/textarea`

#### Tables
- Header: `font-semibold text-sm`
- Row: `border-b` (subtle separation)
- Hover: `hover:bg-muted/50`
- Pagination: Always required for list views

**Shadcn Components:** `@shadcn/table`, `@shadcn/pagination`

---

## Part III: Shadcn UI Components

### 3.1 Available Components (438+ Components)

**Access Methods:**
- **MCP Server:** Use `mcp_presenter-agent-ui-shadcn_*` tools to explore, view, and get examples
- **CLI:** `pnpm dlx shadcn@latest add [component-name]`
- **Registry:** [ui.shadcn.com](https://ui.shadcn.com)

### 3.2 Core Components Used

#### Layout & Navigation
- `@shadcn/card` - Card containers (use `bg-muted/30`, `CardContent` with `pt-6`)
- `@shadcn/separator` - Section dividers
- `@shadcn/sidebar` - Application sidebar
- `@shadcn/breadcrumb` - Navigation breadcrumbs
- `@shadcn/tabs` - Tabbed content sections

#### Forms & Inputs
- `@shadcn/input` - Text inputs (`h-9` height)
- `@shadcn/textarea` - Multi-line text (`text-sm`)
- `@shadcn/label` - Form labels (`text-xs text-muted-foreground`)
- `@shadcn/select` - Dropdown selects
- `@shadcn/checkbox` - Checkboxes
- `@shadcn/radio-group` - Radio button groups
- `@shadcn/switch` - Toggle switches
- `@shadcn/accordion` - Collapsible sections

#### Feedback & Status
- `@shadcn/alert` - Alert messages
- `@shadcn/badge` - Status badges
- `@shadcn/spinner` - Loading indicators (preferred over `Loader2`)
- `@shadcn/skeleton` - Skeleton loaders
- `@shadcn/progress` - Progress bars
- `@shadcn/toast` - Toast notifications (via Sonner)

#### Data Display
- `@shadcn/table` - Data tables
- `@shadcn/pagination` - Pagination controls
- `@shadcn/empty` - Empty states
- `@shadcn/avatar` - User avatars

#### Overlays & Dialogs
- `@shadcn/dialog` - Modal dialogs
- `@shadcn/drawer` - Mobile drawer dialogs
- `@shadcn/sheet` - Slide-over panels
- `@shadcn/dropdown-menu` - Dropdown menus
- `@shadcn/popover` - Popover overlays
- `@shadcn/tooltip` - Tooltips

#### Advanced Components
- `@shadcn/command` - Command palette
- `@shadcn/calendar` - Date picker calendar
- `@shadcn/chart` - Charts (Recharts-based)
- `@shadcn/carousel` - Image carousels
- `@shadcn/form` - React Hook Form integration

### 3.3 Getting Shadcn Components

**View Component Details:**
```typescript
// Use MCP tool to view component
mcp_presenter-agent-ui-shadcn_view_items_in_registries({
  items: ["@shadcn/button", "@shadcn/card"]
})
```

**Get Usage Examples:**
```typescript
// Get examples and demos
mcp_presenter-agent-ui-shadcn_get_item_examples_from_registries({
  registries: ["@shadcn"],
  query: "button-demo"
})
```

**Install Component:**
```bash
# Via CLI
pnpm dlx shadcn@latest add button

# Get add command via MCP
mcp_presenter-agent-ui-shadcn_get_add_command_for_items({
  items: ["@shadcn/button", "@shadcn/card"]
})
```

**Search Components:**
```typescript
// Search by name or description
mcp_presenter-agent-ui-shadcn_search_items_in_registries({
  registries: ["@shadcn"],
  query: "form input"
})
```

### 3.4 Component Usage Guidelines

**Always:**
- ✅ Use Shadcn components for consistency
- ✅ Follow component patterns from examples
- ✅ Customize via className, not by modifying source
- ✅ Use `size="sm"` for buttons in application context
- ✅ Use `h-9` for inputs

**Never:**
- ❌ Modify Shadcn component source files directly
- ❌ Use `Loader2` from lucide-react (use `Spinner` instead)
- ❌ Create custom components that duplicate Shadcn functionality
- ❌ Use oversized typography (`text-xl` or larger for titles)

---

## Part IV: Component Patterns

### 4.1 Page Layout Templates

#### Standard Page Template

```tsx
<div className="space-y-6">
  {/* Page Header */}
  <div className="space-y-0.5">
    <h1 className="text-lg font-semibold">Page Title</h1>
    <p className="mt-0.5 text-sm text-foreground">Page description</p>
  </div>
  
  {/* Page content */}
  <div className="space-y-6">
    {/* Content sections */}
  </div>
</div>
```

#### List Page Template

```tsx
<div className="space-y-6">
  {/* Page Header with Actions */}
  <div className="flex items-center justify-between">
    <div className="space-y-0.5">
      <h1 className="text-lg font-semibold">Resource List</h1>
      <p className="mt-0.5 text-sm text-foreground">Manage your resources</p>
    </div>
    <Button size="sm">
      <Plus className="mr-2 h-3.5 w-3.5" />
      Create Resource
    </Button>
  </div>
  
  {/* Table with Pagination */}
  <Card className="bg-muted/30">
    <CardContent className="pt-6">
      <Table>
        {/* Table content */}
      </Table>
      <Pagination />
    </CardContent>
  </Card>
</div>
```

#### Detail Page Template

```tsx
<div className="space-y-6">
  {/* Page Header */}
  <div className="space-y-0.5">
    <h1 className="text-lg font-semibold">Resource Detail</h1>
    <p className="mt-0.5 text-sm text-foreground">View and manage resource</p>
  </div>
  
  {/* Tabs */}
  <Tabs defaultValue="overview">
    <TabsList>
      <TabsTrigger value="overview">Overview</TabsTrigger>
      <TabsTrigger value="settings">Settings</TabsTrigger>
    </TabsList>
    
    <TabsContent value="overview" className="space-y-4">
      {/* Overview content */}
    </TabsContent>
  </Tabs>
</div>
```

**Shadcn Components:** `@shadcn/card`, `@shadcn/table`, `@shadcn/pagination`, `@shadcn/tabs`, `@shadcn/button`

---

### 4.2 Empty States

**Pattern:**
```tsx
<Card className="bg-muted/30">
  <CardContent className="pt-6">
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <Globe className="h-12 w-12 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-2xl font-semibold">
          No resources yet
        </EmptyTitle>
        <EmptyDescription className="text-sm text-foreground">
          Create your first resource to get started
        </EmptyDescription>
      </EmptyHeader>
      <Button size="lg">
        <Plus className="mr-2 h-4 w-4" />
        Create Resource
      </Button>
    </Empty>
  </CardContent>
</Card>
```

**Guidelines:**
- Calm, instructional (no marketing copy)
- Icon (64x64px max, muted color)
- Title: `text-2xl font-semibold` (only exception to typography rules)
- Description: `text-sm text-foreground`
- CTA: `size="lg"` button (only exception to button sizing)

**Shadcn Component:** `@shadcn/empty`

---

### 4.3 Loading States

**Patterns:**
```tsx
// Page-level skeleton
<Skeleton className="h-8 w-48 mb-2" />
<Skeleton className="h-4 w-96 mb-6" />
<Skeleton className="h-32 w-full" />

// Button loading
<Button disabled size="sm">
  <Spinner className="mr-2 h-3.5 w-3.5" />
  Creating...
</Button>

// Component loading
<Card className="bg-muted/30">
  <CardContent className="pt-6">
    <div className="space-y-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  </CardContent>
</Card>
```

**Guidelines:**
- Use `Spinner` from `@shadcn/spinner` (not `Loader2`)
- Match skeleton structure to final content
- Show loading immediately (no delay)
- Provide context ("Loading agents...", "Fetching data...")

**Shadcn Components:** `@shadcn/skeleton`, `@shadcn/spinner`

---

### 4.4 Error States

**Patterns:**
```tsx
// Page-level error
<Alert variant="destructive" className="py-2">
  <AlertCircle className="h-4 w-4" />
  <AlertDescription className="text-xs">
    <div className="space-y-1">
      <p className="font-medium">Failed to load resources</p>
      <p>{error}</p>
      <Button variant="outline" size="sm" onClick={retry}>
        Retry
      </Button>
    </div>
  </AlertDescription>
</Alert>

// Inline form error
<Input className="h-9 border-destructive" />
<p className="text-xs text-destructive">{error}</p>
```

**Guidelines:**
- Always provide retry mechanism
- Clear, actionable error messages
- Use `Alert` component for page-level errors
- Use inline text for form errors

**Shadcn Components:** `@shadcn/alert`

---

### 4.5 Form Patterns

**Standard Form Structure:**
```tsx
<form className="space-y-4">
  {/* Section Header */}
  <div className="space-y-0.5">
    <h3 className="text-sm font-semibold">Section Title</h3>
    <p className="text-xs text-foreground opacity-85">
      Section description
    </p>
  </div>

  {/* Form Fields */}
  <div className="space-y-1.5">
    <Label htmlFor="field" className="text-xs text-muted-foreground">
      Field Label
    </Label>
    <Input
      id="field"
      className="h-9"
      placeholder="Placeholder text"
    />
    <p className="text-xs text-foreground opacity-85">
      Helper text (NOT muted)
    </p>
  </div>

  {/* Separator */}
  <Separator />

  {/* Submit Button */}
  <div className="flex justify-end gap-2">
    <Button type="button" variant="outline" size="sm">
      Cancel
    </Button>
    <Button type="submit" size="sm">
      Save
    </Button>
  </div>
</form>
```

**Guidelines:**
- Section spacing: `space-y-4`
- Field spacing: `space-y-1.5` or `space-y-2`
- Labels: `text-xs text-muted-foreground`
- Inputs: `h-9` height
- Help text: `text-xs text-foreground opacity-85` (NOT muted)

**Shadcn Components:** `@shadcn/form`, `@shadcn/input`, `@shadcn/label`, `@shadcn/separator`

---

## Part V: Project Lazarus UI

This section defines UI patterns specific to Project Lazarus — the legacy code migration platform. These patterns apply to the Glass Brain Dashboard, migration visualization, and project management.

---

### 5.1 Glass Brain Dashboard (The Lazarus HUD)

**Purpose:** Visualize agent cognition in real time. Backend agents are boring to watch — the Glass Brain makes the agent's thinking visible and theatrical.

**Layout:** Split-screen 3-pane architecture plus a bottom confidence bar.

| Pane | Purpose | Data Source |
|------|---------|-------------|
| **Left: The Plan** | Visual dependency graph of vertical slices | Migration plan JSON |
| **Center: The Work** | Terminal-like streaming code generation | Real-time LLM output |
| **Right: The Thoughts** | Exposed agent "inner monologue" | Thought Signatures XML |
| **Bottom: Confidence** | Live gauge that updates with test results | Confidence calculation |

**Visual Standards:**
- Dark, immersive theme (void-black background, rail-purple accents)
- Monospace font for code pane (JetBrains Mono)
- Space Grotesk for headlines, slice names, confidence numbers
- Subtle animations for thought signatures appearing (framer-motion)
- Confidence gauge uses color transitions (red below 85%, green at 85% or above)

**Shadcn Components:** `@shadcn/card`, `@shadcn/progress`, `@shadcn/separator`, `@shadcn/tabs`, `@shadcn/scroll-area`

**Third-Party:** React Flow (`@xyflow/react`) for dependency graph; Framer Motion for animations

---

### 5.2 Migration Plan View (The Plan Pane)

**Purpose:** Show vertical slices and their dependencies as an interactive graph.

**Layout Requirements:**
- Interactive node graph (nodes = slices, edges = dependencies)
- Node state reflects slice status (pending, building, testing, self_healing, complete, failed)
- Click node to focus or drill into slice details
- Visual hierarchy: completed slices in success color, failed in error, in-progress with spinner
- Collapsible legend for status meanings

**Visual Standards:**
- Node labels: `text-sm font-semibold`
- Status badges on nodes: `@shadcn/badge` with semantic colors
- Graph pan/zoom enabled
- Minimal chrome — focus on the graph

**Shadcn Components:** `@shadcn/badge`, `@shadcn/tooltip`, `@shadcn/scroll-area`

---

### 5.3 Thought Signatures (The Thoughts Pane)

**Purpose:** Display the agent's reasoning in a structured, readable format.

**Structure:** Each Thought Signature contains:
- **Observation** — What specifically failed or was noticed
- **Legacy Context** — How the old system handled it
- **Root Cause** — Why the new code failed
- **Strategy** — Proposed fix (e.g., "Library Adoption: decimal.js")
- **Confidence** — 0.0–1.0 score

**Visual Standards:**
- Card-style blocks with `bg-muted/30`
- Staggered entrance animation when new thoughts appear
- Clear typography hierarchy (observation bold, details muted)
- Timestamp or sequence number for ordering
- Scrollable feed (newest at bottom)

**Shadcn Components:** `@shadcn/card`, `@shadcn/scroll-area`, `@shadcn/badge`

---

### 5.4 Confidence Gauge (Bottom Bar)

**Purpose:** Live confidence score that "jitters" as tests pass or fail. Turns green when ≥ 85%.

**Layout:**
- Full-width or prominent bar at bottom of HUD
- Large numeric display (e.g., `61%` or `91%`)
- Progress bar with semantic colors (red/amber/green)
- Optional: subtle audio tick on increment (use-sound)
- Label: "Confidence" or "Migration Confidence"

**Visual Standards:**
- `text-2xl font-semibold` for percentage
- Progress bar: `@shadcn/progress` with dynamic color
- Smooth transitions (not jarring)
- Visible at all times during migration

**Shadcn Components:** `@shadcn/progress`, `@shadcn/card`

---

### 5.5 Code Stream Pane (The Work Pane)

**Purpose:** Terminal-like display of streaming code generation.

**Layout:**
- Monospace font, dark background
- Syntax highlighting for generated code (optional)
- Auto-scroll as new content streams
- File path header when context switches
- Optional: typing sound effect (keystroke) for theatrical demo

**Visual Standards:**
- JetBrains Mono or similar monospace
- High contrast for readability
- Scroll area with `@shadcn/scroll-area`
- Minimal UI — let the code be the focus

**Shadcn Components:** `@shadcn/scroll-area`, `@shadcn/card`

---

### 5.6 Projects List

**Purpose:** List of migration projects with status and quick actions.

**Layout:**
- Table view with pagination (default 25 per page)
- Columns: Name, Status, Slices (count), Confidence, Last Updated, Actions
- Row click navigates to Glass Brain Dashboard
- Actions: View, Delete (dropdown menu)
- Empty state: "Create your first migration project" with prominent CTA

**Visual Standards:**
- Table layout per Part IV patterns
- Status badges: `pending`, `processing`, `ready`, `building`, `complete`
- Pagination mandatory

**Shadcn Components:** `@shadcn/table`, `@shadcn/pagination`, `@shadcn/dropdown-menu`, `@shadcn/badge`, `@shadcn/empty`

---

### 5.7 Project Creation / Upload Flow

**Purpose:** Create a new migration project by uploading legacy assets.

**Layout:**
- Multi-step or single-page form
- Step 1: Project name, description, target framework (Next.js, etc.)
- Step 2: Upload video recording, documents, or repo link
- Asset list with type badges (video, document, repo) and remove buttons
- Progress indicator during ingestion
- Submit: "Start Migration"

**Guidelines:**
- Form sections with `Separator`
- All inputs `h-9`, labels `text-xs text-muted-foreground`
- Drag-and-drop or file picker for uploads
- Clear validation and error states

**Shadcn Components:** `@shadcn/input`, `@shadcn/textarea`, `@shadcn/label`, `@shadcn/button`, `@shadcn/progress`, `@shadcn/separator`

---

### 5.8 Video Diff / Verification UI (Optional)

**Purpose:** Side-by-side or overlay comparison of legacy vs. modern app behavior.

**Layout:**
- Two video panels (legacy recording | Playwright replay)
- Similarity score display
- Violations list with timestamps and auto-fix suggestions
- Optional: synchronized playback

**Visual Standards:**
- Clear labels: "Legacy" and "Modern"
- Violations in `Alert` or list with `Badge` for severity
- Compact layout — videos are the focus

**Shadcn Components:** `@shadcn/card`, `@shadcn/badge`, `@shadcn/alert`

---

### 5.9 Settings

**Layout:**
- Tabbed navigation (Profile, Authentication, Preferences)
- Each section in `Card` with `bg-muted/30`
- Form sections with `space-y-4` spacing

**Sections:**
- **Profile:** Name, email, avatar
- **Authentication:** Password, OAuth connections
- **Preferences:** Theme, language, notifications

**Guidelines:**
- Inline editing where appropriate
- Modal dialogs for destructive actions
- Toast notifications for success/error feedback

**Shadcn Components:** `@shadcn/tabs`, `@shadcn/card`, `@shadcn/input`, `@shadcn/switch`, `@shadcn/dialog`, `@shadcn/toast`

---

### 5.10 Form Patterns (Universal)

**Standard Form Structure:**
1. **Basic Information** (Name, Description — always first)
2. **Primary Configuration** (Main feature settings)
3. **Additional Options** (Optional features)
4. **Advanced Options** (Accordion with advanced settings)

**Section Organization:**
- Use `Separator` between major sections
- Section headers: `text-sm font-semibold`
- Section descriptions: `text-xs text-foreground opacity-85`

**Guidelines:**
- Most important fields first
- Progressive disclosure for advanced options
- Clear field grouping with visual separation
- Validation feedback inline below fields

**Shadcn Components:** `@shadcn/input`, `@shadcn/label`, `@shadcn/textarea`, `@shadcn/select`, `@shadcn/checkbox`, `@shadcn/switch`, `@shadcn/separator`, `@shadcn/accordion`

---

### 5.11 Theatrical UI Elements

**Purpose:** Special UI overlays and effects designed specifically for the "Vibe Engineering" demo track. These elements create the "wow" factor.

**Neural Handshake (Boot Sequence):**
- **Type:** Full-screen overlay (`z-50`)
- **Style:** `bg-void-black` (solid)
- **Animation:** Central pulsing dot → radiating wireframe lines → "NEURAL LINK ESTABLISHED" text (Electric Cyan, `font-mono`)
- **Duration:** 2-3 seconds

**Victory Lap Overlay:**
- **Type:** Full-screen overlay (`z-50`)
- **Style:** `bg-void-black/90` with `backdrop-blur-xl`
- **Content:** Massive confidence score (Text Gradient), QR Code, "TRANSMUTATION COMPLETE" (`font-grotesk`)
- **Animation:** Particle burst (Confetti)

**Ghost Cursor:**
- **Type:** Floating element (`absolute`) over Work Pane
- **Style:** 12px Electric Cyan circle, 50% opacity, 20px glow
- **Behavior:** Smoothly interpolates to "typing" position

**Chaos Button:**
- **Placement:** Hidden or subtle in header/footer
- **Style:** Ghost button, `text-destructive` hover
- **Label:** "Inject Chaos" or "⚠️"

**Cost Ticker:**
- **Placement:** Floating overlay (bottom-left)
- **Style:** `font-mono`, `bg-card/80`, border-gradient
- **Content:** "Human: $4,200" vs "Lazarus: $0.47"

---

## Part VI: Quality Standards

### 6.1 Enterprise Quality Bar

**Visual Quality:**
- Subtle, calm, credible enterprise-grade aesthetics
- High information density (not spacious)
- Professional polish that signals reliability

**Interaction Design:**
- Predictable, consistent patterns
- Clear visual affordances (buttons look like buttons)
- Smooth micro-interactions

**Information Architecture:**
- Clear hierarchy, high signal-to-noise ratio
- Scalable to hundreds/thousands of items
- No visual noise or decoration

**Usability:**
- Long-session usability (8+ hour workdays)
- Accessible (WCAG AA contrast standards)
- Fast scanning and navigation

---

### 6.2 Anti-Patterns (Forbidden)

**Visual Anti-Patterns:**
- ❌ Oversized typography (`text-xl`, `text-2xl` for titles)
- ❌ Excessive whitespace or padding
- ❌ Marketing-style UI inside application
- ❌ White card backgrounds (`bg-background`)
- ❌ Heavy borders, shadows, or visual noise
- ❌ Muted primary content text

**Structural Anti-Patterns:**
- ❌ Card-based layouts for lists (use tables)
- ❌ Infinite scroll (use pagination)
- ❌ Nested navigation (single-level only)
- ❌ Mixing user-scoped and tenant-scoped settings

**Component Anti-Patterns:**
- ❌ Using `Loader2` (use `Spinner` instead)
- ❌ Creating custom components that duplicate Shadcn
- ❌ Modifying Shadcn component source files
- ❌ Using `CardHeader` when inline headers suffice

---

## Part VII: Reference Checklists

### 7.1 Page-Level Validation Checklist

**Before finalizing any page, validate:**

**Typography:**
- [ ] Page title uses `text-lg font-semibold` (not larger)
- [ ] Page description uses `text-sm text-foreground` with `mt-0.5`
- [ ] Section headers use `text-sm font-semibold`
- [ ] All primary text uses `text-foreground` (NOT muted)
- [ ] Muted text only for form labels, placeholders, metadata

**Layout:**
- [ ] Sections use `space-y-6` spacing
- [ ] Form fields use `space-y-4` or `space-y-2`
- [ ] Cards use `bg-muted/30` background
- [ ] Cards use `CardContent` with `pt-6` (not full padding)

**Components:**
- [ ] All buttons use `size="sm"` (except empty state CTAs)
- [ ] All inputs use `h-9` height
- [ ] All labels use `text-xs text-muted-foreground`
- [ ] Loading states use `Spinner` (not `Loader2`)
- [ ] Empty states use `Empty` component

**Shadcn Usage:**
- [ ] Using Shadcn components (not custom duplicates)
- [ ] Components customized via className (not source modification)
- [ ] Examples referenced from Shadcn registry

---

### 7.2 Component Usage Checklist

**When using any component:**

**Shadcn Components:**
- [ ] Component installed via CLI or MCP
- [ ] Usage matches Shadcn examples
- [ ] Customization via className only
- [ ] No source file modifications

**Typography:**
- [ ] Labels: `text-xs text-muted-foreground`
- [ ] Help text: `text-xs text-foreground` (NOT muted)
- [ ] Headers: `text-sm font-semibold`
- [ ] Body: `text-sm` or `text-xs` with `text-foreground`

**Spacing:**
- [ ] Form sections: `space-y-4`
- [ ] Button groups: `gap-2`
- [ ] Icon + text: `gap-2`

**Accessibility:**
- [ ] Proper label associations
- [ ] ARIA attributes where needed
- [ ] Keyboard navigation support
- [ ] Focus management

---

### 7.3 Feature-Specific Checklist

**Projects List:**
- [ ] Table view (not cards)
- [ ] Pagination implemented (default 25 per page)
- [ ] Row click navigates to Glass Brain Dashboard
- [ ] Actions in dropdown menu
- [ ] Status badges (pending, processing, building, complete)
- [ ] Empty state with actionable CTA ("Create your first migration project")

**Glass Brain Dashboard:**
- [ ] 3-pane layout (Plan | Work | Thoughts)
- [ ] Confidence gauge at bottom
- [ ] Plan pane: interactive dependency graph (React Flow)
- [ ] Work pane: terminal-like code stream with monospace font
- [ ] Thoughts pane: Thought Signature cards with scroll
- [ ] Dark theme, immersive aesthetic

**Project Creation / Upload:**
- [ ] Form sections separated with `Separator`
- [ ] Basic information first (name, description, target framework)
- [ ] Upload step for video, documents, repo
- [ ] Asset list with type badges and remove
- [ ] Clear validation and error messages
- [ ] Loading states with `Spinner`

**Settings:**
- [ ] Tabbed navigation (Profile, Authentication, Preferences)
- [ ] Each section in `Card` with `bg-muted/30`
- [ ] Form patterns with proper spacing
- [ ] Confirmation dialogs for destructive actions
- [ ] Toast notifications for feedback

---

## Appendix A: Shadcn Component Quick Reference

### Layout Components
- **Card:** `@shadcn/card` - Use `bg-muted/30`, `CardContent` with `pt-6`
- **Separator:** `@shadcn/separator` - Section dividers
- **Tabs:** `@shadcn/tabs` - Tabbed content sections

### Form Components
- **Input:** `@shadcn/input` - Always `h-9` height
- **Label:** `@shadcn/label` - Use `text-xs text-muted-foreground`
- **Textarea:** `@shadcn/textarea` - Use `text-sm`
- **Select:** `@shadcn/select` - Dropdown selects
- **Checkbox:** `@shadcn/checkbox` - Checkboxes
- **Radio Group:** `@shadcn/radio-group` - Radio buttons
- **Switch:** `@shadcn/switch` - Toggle switches
- **Accordion:** `@shadcn/accordion` - Collapsible sections

### Feedback Components
- **Alert:** `@shadcn/alert` - Error/success messages
- **Badge:** `@shadcn/badge` - Status indicators
- **Spinner:** `@shadcn/spinner` - Loading indicators (preferred)
- **Skeleton:** `@shadcn/skeleton` - Skeleton loaders
- **Progress:** `@shadcn/progress` - Progress bars
- **Toast:** `@shadcn/toast` - Toast notifications (Sonner)

### Data Display Components
- **Table:** `@shadcn/table` - Data tables
- **Pagination:** `@shadcn/pagination` - Pagination controls
- **Empty:** `@shadcn/empty` - Empty states
- **Avatar:** `@shadcn/avatar` - User avatars

### Interactive Components
- **Button:** `@shadcn/button` - Use `size="sm"` in app
- **Dialog:** `@shadcn/dialog` - Modal dialogs
- **Dropdown Menu:** `@shadcn/dropdown-menu` - Dropdown menus
- **Popover:** `@shadcn/popover` - Popover overlays
- **Tooltip:** `@shadcn/tooltip` - Tooltips

### Accessing Shadcn Components

**Via MCP (Recommended):**
```typescript
// View component details
mcp_presenter-agent-ui-shadcn_view_items_in_registries({
  items: ["@shadcn/button"]
})

// Get usage examples
mcp_presenter-agent-ui-shadcn_get_item_examples_from_registries({
  registries: ["@shadcn"],
  query: "button-demo"
})

// Get installation command
mcp_presenter-agent-ui-shadcn_get_add_command_for_items({
  items: ["@shadcn/button"]
})
```

**Via CLI:**
```bash
pnpm dlx shadcn@latest add button
```

**Registry URL:**
- Main Registry: https://ui.shadcn.com
- Component Docs: https://ui.shadcn.com/docs/components/[component-name]
- Examples: Available via MCP tools

---

## Appendix B: Brand Guidelines Reference

**Color Palette:**
- Primary: Cornflower Blue `#568AFF`
- Secondary: Green-Blue `#0665BA`
- Rich Black: `#001320` (for text)

**Typography:**
- Headlines: Poppins Semi Bold (600)
- Body: Poppins Regular (400)
- Accent: Sofia Sans Extra Condensed (sparingly)

**Full Guidelines:** See `brand/brand.md` for complete brand guidelines

---

## Appendix C: Quick Reference Commands

### Explore Shadcn Components
```typescript
// List all available components
mcp_presenter-agent-ui-shadcn_list_items_in_registries({
  registries: ["@shadcn"],
  limit: 50
})

// Search for components
mcp_presenter-agent-ui-shadcn_search_items_in_registries({
  registries: ["@shadcn"],
  query: "form input"
})

// View specific components
mcp_presenter-agent-ui-shadcn_view_items_in_registries({
  items: ["@shadcn/button", "@shadcn/card"]
})
```

### Get Component Examples
```typescript
// Get examples by query
mcp_presenter-agent-ui-shadcn_get_item_examples_from_registries({
  registries: ["@shadcn"],
  query: "button-demo"
})

// Get add command
mcp_presenter-agent-ui-shadcn_get_add_command_for_items({
  items: ["@shadcn/button"]
})
```

---

**Document Status:** ✅ Complete  
**Last Updated:** February 2026  
**Product:** Project Lazarus  
**Component Library:** Shadcn UI (438+ components)  
**Next Review:** Quarterly or when major design system changes occur
