# Architecture

Complete architecture documentation for Project Lazarus — The Legacy Code Necromancer.

---

## Overview

Project Lazarus is an autonomous AI agent that transmutes legacy software into modern web applications. The architecture centers on the Lazarus Loop (orchestration pipeline), the Glass Brain Dashboard (visible cognition), and vertical slice migration.

---

## The Lazarus Loop

The orchestration layer follows a cyclic pipeline:

**Ingest** — Accept legacy inputs: video recordings, documents, source code, screenshots. Assets are stored and queued for analysis.

**Analyze** — Correlate video behavior with code structure. The Left Brain (Code-Synapse MCP) parses the codebase; the Right Brain (Knowledge Extraction MCP) extracts tasks and behavior from video. Outputs feed the planning phase.

**Plan** — Produce a migration plan as vertical slices. Each slice has a behavioral contract (from video), a code contract (from code analysis), and optional modernization flags.

**Generate** — Build modern code slice-by-slice. OpenHands SDK or Gemini drives code generation. Output streams to the Glass Brain Work pane.

**Verify** — Run unit tests (Vitest), E2E tests (Playwright), and visual regression. Compute confidence from test pass rates and visual/behavioral match.

**Confidence Check** — If confidence ≥ 85%, proceed to Modernize. If below, and retries fewer than 5, invoke Self-Heal.

**Self-Heal** — Diagnose failure via Thought Signature, propose a fix (e.g., adopt decimal.js for precision), regenerate code, and re-run verification.

**Modernize** — Apply optional enhancements: MCP server generation, chat interface, API endpoints.

**Refinement Loop** — Compare legacy vs. modern app via bi-directional video diff (Gemini). Apply layout/CSS fixes as needed.

---

## Glass Brain Dashboard

The Lazarus HUD visualizes agent cognition in real time.

**Left Pane — The Plan:** Interactive dependency graph of vertical slices. Nodes represent slices; edges show dependencies. Node state reflects status (pending, building, testing, self_healing, complete, failed).

**Center Pane — The Work:** Terminal-like streaming code output. Monospace font, syntax highlighting, auto-scroll.

**Right Pane — The Thoughts:** Thought Signature cards. Each contains observation, legacy context, root cause, strategy, and confidence.

**Bottom Bar — Confidence Gauge:** Live percentage and progress bar. Red/amber below 85%, green at or above 85%. Updates as tests pass or fail.

---

## Vertical Slice Architecture

Traditional migrations rebuild by layer. Lazarus rebuilds by feature using vertical slices.

**Behavioral Contract (from Right Brain):** Inputs, expected outputs, visual assertions extracted from video.

**Code Contract (from Left Brain):** Legacy functions, business logic, data schema.

**Modernization Flags:** MCP server, chat interface, API endpoint suggestions.

**Slice Lifecycle:** pending → selected → building → testing → self_healing (on failure) → complete or failed.

**Benefits:** Each slice is self-contained and testable; incremental confidence; parallel execution; reduced risk.

---

## Database Architecture

**Supabase (PostgreSQL):** Primary database for application data and auth.

**Auth Tables:** Managed by Better Auth (user, session, account, organization, member, invitation).

**Application Tables:** projects, project_assets, vertical_slices, agent_events, activities, audit_logs, usage.

**Storage Buckets:** project-videos, project-documents, project-screenshots, agent-artifacts.

**Realtime:** Enabled on agent_events and vertical_slices for live Glass Brain updates.

---

## Authentication & Authorization

**Better Auth:** Email/password, Google OAuth, email verification, session management.

**Organization Plugin:** Optional multi-tenancy. Organizations, members, invitations, role-based access.

**Roles:** owner, admin, member, viewer. Permissions control project creation, viewing, and management.

**Protected Routes:** Dashboard, projects, settings, admin.

---

## AI & Agent Architecture

**Gemini:** Planning, Thought Signatures, confidence explanation, video comparison.

**OpenHands SDK:** Code generation and editing (headless agent).

**MCP Integration:**
- Left Brain (Code-Synapse): Codebase parsing, knowledge graph, business justification.
- Right Brain (Knowledge Extraction): Video ingestion, task extraction, behavioral mapping.

**Agent Events:** Streamed to agent_events table for Glass Brain display. Types include thought, tool_call, observation, code_write, test_run, test_result, self_heal, confidence_update.

---

## Job Queue Architecture

**BullMQ + Redis:** Background job processing with retries and prioritization.

**Queues:** email (sending), processing (long-running tasks), webhooks (external HTTP calls).

**Usage:** Queue ingestion tasks, code generation steps, email notifications, webhook deliveries.

---

## Verification & Self-Healing

**Test Tiers:** Unit (Vitest), E2E (Playwright), visual regression, behavioral match, video comparison.

**Confidence Calculation:** Weighted combination of unit pass rate, E2E pass rate, visual match, behavioral match, and video similarity.

**Threshold:** 85% default; higher for critical slices (e.g., payment, auth).

**Self-Healing Chain:** Parse failure → diagnose via Thought Signature → propose fix → regenerate → re-verify. Max 5 retries per slice.

---

## File Storage & Uploads

**Supabase Storage:** Videos, documents, screenshots, generated artifacts.

**Upload Flow:** User uploads via project creation form. Files stored in buckets; metadata in project_assets.

---

## Activity & Audit

**Activity Feed:** User and organization-scoped events. Types include project.created, project.updated, ai_agent.run, document.created.

**Audit Logs:** Action, resource, resourceId, metadata, ipAddress, userAgent. Non-throwing — errors logged, not propagated.

---

## Rate Limiting

**Purpose:** Protect API and agent endpoints from abuse.

**Storage:** MongoDB or Supabase with TTL for automatic cleanup.

**Headers:** X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.

---

## Usage Tracking

**Purpose:** Track API calls, AI requests, and feature usage per user/organization.

**Usage Types:** api_call, ai_request, storage, bandwidth, feature_usage.

**Quota Enforcement:** Optional. Check usage against limits before allowing actions.

---

## Video Diff & Refinement

**Purpose:** Compare legacy app recording with Playwright replay of modern app.

**Flow:** Both videos sent to Gemini. Output: visual_similarity, timing_match, violations (with timestamps and auto-fix suggestions).

**Refinement:** Violations (e.g., color mismatch) fed back to code generation for CSS/layout fixes.

---

## Security

**Authentication:** Session validation on protected routes and API calls.

**Multi-Tenancy:** Organization membership verified before data access.

**AI Agents:** Tool inputs validated; rate limits on agent API; audit logging of agent interactions.

**Webhooks:** HMAC signature verification if external webhooks are used.

---

## Performance

**Database:** Indexes on frequently queried fields (user_id, org_id, project_id, created_at).

**Realtime:** Supabase Realtime for agent_events and vertical_slices to minimize polling.

**Job Queues:** Concurrency tuned per queue; prioritization for critical jobs.

---

## Key Directories

**lib/auth:** Better Auth configuration.

**lib/db:** Supabase client, browser client, types.

**lib/ai:** Agent runner, tools, Gemini integration.

**lib/queue:** BullMQ queues and workers.

**lib/activity:** Activity feed.

**lib/audit:** Audit logging.

**lib/usage:** Usage tracking.

**app/(dashboard):** Projects list, Glass Brain Dashboard.

**app/(auth):** Login, register, verify-email.

---

## Resources

- Better Auth Organization Docs
- Supabase Documentation
- BullMQ Documentation
- Project Lazarus Ideation (docs/project_lazarus.md)
- Implementation Guide (docs/IMPLEMENTATION.md)
