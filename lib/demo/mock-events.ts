/**
 * Pre-scripted event sequences for demo mode slice builds.
 * Each sequence simulates a realistic OpenHands agent building a vertical slice.
 * Events include thoughts, tool calls, code writes, tests, and self-heal cycles.
 */

import type { AgentEventType } from "@/lib/db/types"

export interface MockEvent {
  event_type: AgentEventType
  content: string
  metadata?: Record<string, unknown>
  confidence_delta?: number
  /** Delay in ms BEFORE this event is emitted */
  delay: number
}

/* -------------------------------------------------------------------------- */
/*  Reusable fragments                                                         */
/* -------------------------------------------------------------------------- */

const scaffoldSetup: MockEvent[] = [
  {
    event_type: "thought",
    content: "Analyzing slice contracts and dependencies...",
    delay: 1500,
    confidence_delta: 0.02,
  },
  {
    event_type: "thought",
    content: "Planning implementation approach based on behavioral contract...",
    delay: 2000,
    confidence_delta: 0.01,
  },
  {
    event_type: "tool_call",
    content: "Reading existing project structure",
    metadata: { tool: "file_read", path: "src/" },
    delay: 1200,
  },
  {
    event_type: "observation",
    content: "Found 12 existing files. Identified integration points.",
    delay: 800,
  },
]

function makeCodeWrite(
  file: string,
  description: string,
  linesAdded: number,
  delay = 1500
): MockEvent {
  return {
    event_type: "code_write",
    content: `Writing ${file}: ${description}`,
    metadata: { file, lines_added: linesAdded, lines_removed: 0 },
    confidence_delta: 0.03,
    delay,
  }
}

function makeTestCycle(
  pass: boolean,
  testCount: number,
  passCount: number,
  failReason?: string
): MockEvent[] {
  const events: MockEvent[] = [
    {
      event_type: "test_run",
      content: `Running test suite (${testCount} tests)...`,
      delay: 2500,
    },
    {
      event_type: "test_result",
      content: pass
        ? `All ${passCount} tests passed`
        : `${passCount}/${testCount} tests passed — ${failReason ?? "assertion error"}`,
      metadata: {
        passed: pass,
        total: testCount,
        pass_count: passCount,
        fail_count: testCount - passCount,
      },
      confidence_delta: pass ? 0.12 : -0.05,
      delay: 3000,
    },
  ]
  return events
}

function makeSelfHealCycle(
  issue: string,
  fix: string,
  file: string
): MockEvent[] {
  return [
    {
      event_type: "self_heal",
      content: `Detected issue: ${issue}`,
      metadata: { attempt: 1, max_retries: 5 },
      delay: 2000,
    },
    {
      event_type: "thought",
      content: `Analyzing root cause... ${issue}`,
      delay: 1800,
      confidence_delta: 0.01,
    },
    {
      event_type: "thought",
      content: `Found fix: ${fix}`,
      delay: 1500,
      confidence_delta: 0.02,
    },
    {
      event_type: "code_write",
      content: `Applying fix to ${file}`,
      metadata: { file, lines_added: 3, lines_removed: 2 },
      confidence_delta: 0.03,
      delay: 1200,
    },
  ]
}

/* -------------------------------------------------------------------------- */
/*  Slice-specific build sequences                                             */
/* -------------------------------------------------------------------------- */

const authSliceSequence: MockEvent[] = [
  ...scaffoldSetup,
  makeCodeWrite("lib/auth/session.ts", "Session management with JWT tokens", 45),
  makeCodeWrite("lib/auth/middleware.ts", "Route protection middleware", 32, 1200),
  makeCodeWrite("components/auth/login-form.tsx", "Login form with validation", 78, 1800),
  makeCodeWrite("components/auth/register-form.tsx", "Registration with password strength", 65, 1500),
  makeCodeWrite("app/api/auth/[...auth]/route.ts", "Auth API route handler", 28, 1000),
  {
    event_type: "tool_call",
    content: "Installing dependencies: bcryptjs, jose",
    metadata: { tool: "terminal", command: "pnpm add bcryptjs jose" },
    delay: 2000,
  },
  {
    event_type: "observation",
    content: "Dependencies installed successfully.",
    delay: 1500,
  },
  makeCodeWrite("__tests__/auth/session.test.ts", "Session management tests", 42, 1200),
  makeCodeWrite("__tests__/auth/login.test.tsx", "Login form component tests", 56, 1000),
  // First test run — fail for drama
  ...makeTestCycle(false, 8, 6, "JWT token expiry not handled"),
  // Self-heal
  ...makeSelfHealCycle(
    "JWT token expiry not handled in session refresh",
    "Add token rotation with sliding window expiry",
    "lib/auth/session.ts"
  ),
  // Retry tests — pass
  ...makeTestCycle(true, 8, 8),
  {
    event_type: "thought",
    content: "Auth slice build complete. All tests passing.",
    delay: 1000,
    confidence_delta: 0.05,
  },
]

const dashboardSliceSequence: MockEvent[] = [
  ...scaffoldSetup,
  makeCodeWrite("components/dashboard/stats-grid.tsx", "Real-time statistics grid", 92),
  makeCodeWrite("components/dashboard/activity-feed.tsx", "Live activity feed with infinite scroll", 68, 1500),
  makeCodeWrite("components/dashboard/chart-panel.tsx", "Interactive chart panel with Recharts", 85, 2000),
  makeCodeWrite("app/(dashboard)/page.tsx", "Dashboard layout with responsive grid", 54, 1200),
  makeCodeWrite("hooks/use-dashboard-data.ts", "Data fetching hook with SWR", 38, 1000),
  {
    event_type: "tool_call",
    content: "Verifying responsive layout breakpoints",
    metadata: { tool: "browser", action: "resize" },
    delay: 1500,
  },
  {
    event_type: "observation",
    content: "Layout renders correctly at all breakpoints (sm, md, lg, xl).",
    delay: 1200,
  },
  makeCodeWrite("__tests__/dashboard/stats-grid.test.tsx", "Stats grid tests", 48, 1000),
  makeCodeWrite("__tests__/dashboard/activity-feed.test.tsx", "Activity feed tests", 35, 800),
  // Tests pass first time
  ...makeTestCycle(true, 6, 6),
  {
    event_type: "thought",
    content: "Dashboard slice build complete. Responsive layout verified.",
    delay: 1000,
    confidence_delta: 0.05,
  },
]

const apiRoutesSequence: MockEvent[] = [
  ...scaffoldSetup,
  makeCodeWrite("app/api/v1/users/route.ts", "Users CRUD endpoints", 62),
  makeCodeWrite("app/api/v1/projects/route.ts", "Projects CRUD with pagination", 78, 1500),
  makeCodeWrite("lib/api/validation.ts", "Zod request validation middleware", 45, 1200),
  makeCodeWrite("lib/api/error-handler.ts", "Centralized error response handler", 32, 1000),
  makeCodeWrite("app/api/v1/webhooks/route.ts", "Webhook ingestion endpoint", 48, 1500),
  {
    event_type: "tool_call",
    content: "Setting up API rate limiting",
    metadata: { tool: "terminal", command: "pnpm add @upstash/ratelimit" },
    delay: 1800,
  },
  makeCodeWrite("lib/api/rate-limit.ts", "Rate limiting with Upstash Redis", 28, 1200),
  makeCodeWrite("__tests__/api/users.test.ts", "Users API integration tests", 72, 1000),
  makeCodeWrite("__tests__/api/projects.test.ts", "Projects API tests", 65, 800),
  // Fail — missing env var
  ...makeTestCycle(false, 10, 7, "DATABASE_URL not configured in test environment"),
  ...makeSelfHealCycle(
    "Test environment missing DATABASE_URL",
    "Add dotenv config for test environment",
    "vitest.config.ts"
  ),
  ...makeTestCycle(true, 10, 10),
  {
    event_type: "thought",
    content: "API routes slice complete. All endpoints tested.",
    delay: 1000,
    confidence_delta: 0.05,
  },
]

const settingsSliceSequence: MockEvent[] = [
  ...scaffoldSetup,
  makeCodeWrite("app/(dashboard)/settings/page.tsx", "Settings page with tabs", 72),
  makeCodeWrite("components/settings/profile-form.tsx", "Profile editing form", 58, 1300),
  makeCodeWrite("components/settings/notification-prefs.tsx", "Notification preferences", 42, 1200),
  makeCodeWrite("components/settings/danger-zone.tsx", "Account deletion with confirmation", 36, 1000),
  makeCodeWrite("app/api/settings/route.ts", "Settings API endpoint", 34, 1100),
  makeCodeWrite("__tests__/settings/profile.test.tsx", "Profile form tests", 40, 1000),
  ...makeTestCycle(true, 5, 5),
  {
    event_type: "thought",
    content: "Settings slice complete. Profile management working.",
    delay: 1000,
    confidence_delta: 0.05,
  },
]

const dataLayerSequence: MockEvent[] = [
  ...scaffoldSetup,
  makeCodeWrite("lib/db/schema.ts", "Database schema with Drizzle ORM", 95),
  makeCodeWrite("lib/db/migrations/001_initial.sql", "Initial migration with tables", 68, 1500),
  makeCodeWrite("lib/db/queries.ts", "Type-safe query builder functions", 82, 1800),
  makeCodeWrite("lib/db/seed.ts", "Database seed script with sample data", 54, 1200),
  {
    event_type: "tool_call",
    content: "Running database migrations",
    metadata: { tool: "terminal", command: "pnpm drizzle-kit push" },
    delay: 2500,
  },
  {
    event_type: "observation",
    content: "Migrations applied successfully. 5 tables created.",
    delay: 1500,
  },
  makeCodeWrite("__tests__/db/queries.test.ts", "Database query tests", 56, 1000),
  // Fail — constraint violation
  ...makeTestCycle(false, 7, 5, "unique constraint violation on user.email"),
  ...makeSelfHealCycle(
    "Seed data contains duplicate emails",
    "Add unique constraint handling and upsert logic",
    "lib/db/queries.ts"
  ),
  ...makeTestCycle(true, 7, 7),
  {
    event_type: "thought",
    content: "Data layer slice complete. Schema migrations verified.",
    delay: 1000,
    confidence_delta: 0.05,
  },
]

/* -------------------------------------------------------------------------- */
/*  Generic fallback for slices without a specific sequence                     */
/* -------------------------------------------------------------------------- */

function generateGenericSequence(sliceName: string): MockEvent[] {
  const safeName = sliceName.toLowerCase().replace(/\s+/g, "-")
  return [
    ...scaffoldSetup,
    makeCodeWrite(
      `components/${safeName}/index.tsx`,
      `Main ${sliceName} component`,
      72
    ),
    makeCodeWrite(
      `components/${safeName}/utils.ts`,
      `${sliceName} utility functions`,
      38,
      1200
    ),
    makeCodeWrite(
      `app/(dashboard)/${safeName}/page.tsx`,
      `${sliceName} page route`,
      45,
      1300
    ),
    makeCodeWrite(
      `app/api/${safeName}/route.ts`,
      `${sliceName} API endpoint`,
      52,
      1100
    ),
    makeCodeWrite(
      `__tests__/${safeName}/index.test.tsx`,
      `${sliceName} component tests`,
      44,
      1000
    ),
    ...makeTestCycle(false, 6, 4, "missing import in component"),
    ...makeSelfHealCycle(
      `Import path incorrect for ${sliceName} utilities`,
      "Update import to use correct alias path",
      `components/${safeName}/index.tsx`
    ),
    ...makeTestCycle(true, 6, 6),
    {
      event_type: "thought",
      content: `${sliceName} slice build complete. All tests passing.`,
      delay: 1000,
      confidence_delta: 0.05,
    },
  ]
}

/* -------------------------------------------------------------------------- */
/*  Export: get sequence for a slice                                            */
/* -------------------------------------------------------------------------- */

const NAMED_SEQUENCES: Record<string, MockEvent[]> = {
  auth: authSliceSequence,
  authentication: authSliceSequence,
  login: authSliceSequence,
  dashboard: dashboardSliceSequence,
  overview: dashboardSliceSequence,
  api: apiRoutesSequence,
  routes: apiRoutesSequence,
  endpoints: apiRoutesSequence,
  settings: settingsSliceSequence,
  preferences: settingsSliceSequence,
  profile: settingsSliceSequence,
  data: dataLayerSequence,
  database: dataLayerSequence,
  schema: dataLayerSequence,
}

/**
 * Get a mock event sequence for a slice build.
 * Matches by slice name keywords, falling back to a generic sequence.
 */
export function getMockBuildSequence(sliceName: string): MockEvent[] {
  const lower = sliceName.toLowerCase()

  // Check for keyword match
  for (const [keyword, sequence] of Object.entries(NAMED_SEQUENCES)) {
    if (lower.includes(keyword)) {
      return sequence
    }
  }

  return generateGenericSequence(sliceName)
}

/**
 * Setup log events for the demo processing phase.
 * These appear during "left brain" analysis to show dramatic setup steps.
 */
export function getDemoSetupLogs(repoUrl: string): MockEvent[] {
  const repoName = repoUrl.split("/").pop()?.replace(".git", "") ?? "target-repo"
  return [
    {
      event_type: "thought",
      content: "Initializing secure sandbox environment...",
      delay: 1000,
    },
    {
      event_type: "thought",
      content: "Verifying Node.js 22+ runtime...",
      delay: 800,
    },
    {
      event_type: "thought",
      content: "Node.js v22.11.0 detected. Runtime verified.",
      delay: 600,
    },
    {
      event_type: "thought",
      content: "Checking pnpm package manager...",
      delay: 500,
    },
    {
      event_type: "thought",
      content: "pnpm 9.15.4 ready.",
      delay: 400,
    },
    {
      event_type: "thought",
      content: "Bootstrapping Code-Synapse analysis engine...",
      delay: 1200,
    },
    {
      event_type: "thought",
      content: "Code-Synapse CLI linked globally. Engine ready.",
      delay: 1500,
    },
    {
      event_type: "thought",
      content: `Cloning target repository: ${repoUrl}...`,
      delay: 2000,
    },
    {
      event_type: "thought",
      content: `Repository ${repoName} cloned successfully.`,
      delay: 1500,
    },
    {
      event_type: "thought",
      content: "Initializing Code-Synapse on target codebase...",
      delay: 1000,
    },
    {
      event_type: "thought",
      content: "Configuring analysis with Google AI provider...",
      delay: 800,
    },
    {
      event_type: "thought",
      content: "Running deep codebase indexing...",
      delay: 1500,
    },
    {
      event_type: "thought",
      content: "Index complete. MCP server starting on port 3100...",
      delay: 2000,
    },
    {
      event_type: "thought",
      content: "MCP server online. Neural link established.",
      delay: 1000,
      confidence_delta: 0.05,
    },
  ]
}
