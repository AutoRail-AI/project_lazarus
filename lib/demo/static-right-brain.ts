/**
 * Static Right Brain for demo mode.
 *
 * Always used in demo mode instead of the real Right Brain API (which takes ~1 hour).
 * Reads pre-computed data from `public/pos-analysis/`.
 *
 * Produces (~60s total):
 * 1. Dramatic paced logs (~20s simulating ingestion/analysis)
 * 2. Screenshot events with frame images + analysis text (~35s)
 * 3. Summary from report.md (~5s)
 * 4. Structured behavioral data for the Analysis Config View
 */

import { readFile } from "fs/promises"
import { join } from "path"
import type { Job } from "bullmq"
import { supabase } from "@/lib/db"
import type { ProjectProcessingJobData } from "@/lib/queue/types"

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function insertThought(
  projectId: string,
  content: string
): Promise<void> {
  await (supabase as any).from("agent_events").insert({
    project_id: projectId,
    slice_id: null,
    event_type: "thought",
    content,
  })
}

async function insertScreenshot(
  projectId: string,
  content: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await (supabase as any).from("agent_events").insert({
    project_id: projectId,
    slice_id: null,
    event_type: "screenshot",
    content,
    metadata,
  })
}

async function pacedLog(
  projectId: string,
  content: string,
  delayMs: number
): Promise<void> {
  await sleep(delayMs)
  console.log(`[Demo Static RB] ${content}`)
  await insertThought(projectId, content)
}

/* -------------------------------------------------------------------------- */
/*  Types for analysis.json                                                    */
/* -------------------------------------------------------------------------- */

interface AnalysisMeta {
  title: string
  source_application: string
  source_technology: string
  source_video_duration_seconds: number
  source_video_resolution: string
  total_frames_extracted: number
  key_frames_selected: number
}

interface FrameManifestEntry {
  id: string
  file: string
  screen: string
  description: string
}

interface NavItem {
  label: string
  group: string
  screen: string
}

interface ScreenComponent {
  type: string
}

interface ScreenIssue {
  severity: string
  category: string
  description: string
}

interface NextJsProposal {
  route: string
  features?: string[]
}

interface AnalysisScreen {
  id: string
  name: string
  type: string
  current_state?: {
    layout?: string
    components?: ScreenComponent[]
  }
  issues?: ScreenIssue[]
  nextjs_proposal?: NextJsProposal
}

interface AnalysisBug {
  id: string
  screen: string
  severity: string
  category: string
  title: string
  description: string
}

interface MigrationPhase {
  phase: number
  name: string
  weeks: string
  scope: string
  deliverables: string[]
}

interface AnalysisJson {
  meta: AnalysisMeta
  frames_manifest: FrameManifestEntry[]
  application_structure: {
    navigation: {
      type: string
      items: NavItem[]
    }
  }
  screens: AnalysisScreen[]
  bugs: AnalysisBug[]
  migration_roadmap: {
    phases: MigrationPhase[]
  }
  nextjs_architecture: {
    route_map: Array<{ path: string }>
    layouts: Record<string, string>
    tech_stack: Record<string, unknown>
  }
}

/* -------------------------------------------------------------------------- */
/*  Main function                                                              */
/* -------------------------------------------------------------------------- */

export async function demoStaticRightBrain(
  projectId: string,
  job: Job<ProjectProcessingJobData>
): Promise<Record<string, unknown>> {
  const basePath = join(process.cwd(), "public", "pos-analysis")

  // Read analysis.json
  const analysisRaw = await readFile(join(basePath, "analysis.json"), "utf-8")
  const analysis = JSON.parse(analysisRaw) as AnalysisJson

  const {
    meta,
    frames_manifest: framesManifest,
    application_structure: appStructure,
    screens,
    bugs,
    migration_roadmap: roadmap,
    nextjs_architecture: nextjsArch,
  } = analysis

  const navItems = appStructure.navigation.items
  const migrationPhases = roadmap.phases

  /* ======================================================================== */
  /*  Phase 1 — Simulated ingestion logs (~20s)                                */
  /* ======================================================================== */

  await pacedLog(
    projectId,
    "[App Behaviour] Connecting to Knowledge Extraction Service...",
    400
  )
  await pacedLog(
    projectId,
    "[App Behaviour] Starting App behaviour analysis...",
    500
  )
  await pacedLog(
    projectId,
    `[App Behaviour] Source: ${meta.source_application} (${meta.source_technology})`,
    300
  )
  await pacedLog(
    projectId,
    `[App Behaviour] Video duration: ${meta.source_video_duration_seconds}s, Resolution: ${meta.source_video_resolution}`,
    400
  )
  await pacedLog(
    projectId,
    `[App Behaviour] Extracted ${meta.key_frames_selected} key frames from ${meta.total_frames_extracted} total frames`,
    600
  )
  await pacedLog(
    projectId,
    "[App Behaviour] Initializing screen detection pipeline...",
    800
  )

  // Navigation analysis
  await pacedLog(
    projectId,
    `[App Behaviour] Detected navigation: ${appStructure.navigation.type} with ${navItems.length} items`,
    400
  )
  const groups = Array.from(new Set(navItems.map((item) => item.group)))
  await pacedLog(
    projectId,
    `[App Behaviour] Navigation groups: ${groups.join(", ")}`,
    300
  )

  // Screen scanning
  await pacedLog(
    projectId,
    "[App Behaviour] Scanning application screens...",
    500
  )
  for (const screen of screens) {
    const issueCount = screen.issues?.length ?? 0
    await pacedLog(
      projectId,
      `[App Behaviour]   \u2192 ${screen.name} (${screen.type}): ${issueCount} issues found`,
      150 + Math.floor(Math.random() * 100)
    )
  }

  // Bug detection
  await pacedLog(
    projectId,
    "[App Behaviour] Bug detection scan starting...",
    600
  )
  for (const bug of bugs) {
    await pacedLog(
      projectId,
      `[App Behaviour]   \u2192 [${bug.severity}] ${bug.title}`,
      150
    )
  }

  const criticalCount = bugs.filter((b) => b.severity === "critical").length
  const highCount = bugs.filter((b) => b.severity === "high").length
  const mediumCount = bugs.filter((b) => b.severity === "medium").length
  await pacedLog(
    projectId,
    `[App Behaviour] ${criticalCount} critical, ${highCount} high, ${mediumCount} medium severity bugs identified`,
    300
  )

  // Derive vertical slices from screens (user-facing features)
  await pacedLog(
    projectId,
    "[App Behaviour] Deriving vertical slices from screen analysis...",
    600
  )

  // Build vertical slices — each screen becomes an independently deliverable feature
  const verticalSlices = screens.map((s) => {
    const issueCount = s.issues?.length ?? 0
    const featureCount = s.nextjs_proposal?.features?.length ?? 0
    const route = s.nextjs_proposal?.route ?? null
    const screenBugs = bugs.filter((b) => b.screen === s.id || b.screen === "all_crud")
    return {
      name: s.name,
      screen_id: s.id,
      type: s.type,
      route,
      description: s.nextjs_proposal
        ? `${route} \u2014 ${featureCount} features, ${issueCount} issues to resolve`
        : `${s.type} screen \u2014 ${issueCount} issues to resolve`,
      issues: issueCount,
      features: featureCount,
      bugs: screenBugs.length,
      components: s.current_state?.components?.length ?? 0,
    }
  })

  for (const slice of verticalSlices) {
    await pacedLog(
      projectId,
      `[App Behaviour]   \u2192 ${slice.name}: ${slice.route ?? slice.type} (${slice.features} features, ${slice.issues} issues, ${slice.bugs} bugs)`,
      150 + Math.floor(Math.random() * 100)
    )
  }

  await pacedLog(
    projectId,
    `[App Behaviour] ${verticalSlices.length} vertical slices identified from ${screens.length} screens`,
    300
  )

  // Architecture analysis
  await pacedLog(
    projectId,
    "[App Behaviour] Mapping Next.js route architecture...",
    500
  )
  const routeMap = nextjsArch.route_map
  const layoutCount = Object.keys(nextjsArch.layouts).length
  await pacedLog(
    projectId,
    `[App Behaviour]   \u2192 ${routeMap.length} routes across ${layoutCount} layout types (auth, dashboard, fullscreen)`,
    300
  )

  const techStack = nextjsArch.tech_stack
  const keyTechs = Object.entries(techStack)
    .slice(0, 6)
    .map(([, val]) => {
      if (typeof val === "object" && val !== null && "name" in val) {
        return (val as { name: string }).name
      }
      return String(val)
    })
  await pacedLog(
    projectId,
    `[App Behaviour]   \u2192 Tech stack: ${keyTechs.join(", ")}`,
    300
  )

  // Bug severity summary
  await pacedLog(
    projectId,
    `[App Behaviour] Bug severity breakdown: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium \u2014 ${criticalCount + highCount} require immediate attention`,
    400
  )

  await job.updateProgress(55)

  /* ======================================================================== */
  /*  Phase 2 — Frame-by-frame screenshots (~35s for 14 frames)                */
  /* ======================================================================== */

  await pacedLog(
    projectId,
    `[App Behaviour] Beginning frame-by-frame analysis (${framesManifest.length} frames)...`,
    400
  )

  const progressStart = 55
  const progressEnd = 70

  for (let i = 0; i < framesManifest.length; i++) {
    const frame = framesManifest[i]!
    const descTruncated =
      frame.description.length > 80
        ? frame.description.slice(0, 80) + "..."
        : frame.description

    // Thought event with frame description
    await pacedLog(
      projectId,
      `[App Behaviour] Analyzing frame: ${frame.screen} \u2014 ${descTruncated}`,
      400
    )

    // Screenshot event with image URL
    await insertScreenshot(projectId, frame.description, {
      url: `/pos-analysis/${frame.file}`,
      step: frame.screen,
    })

    // Update progress incrementally
    const progress = Math.round(
      progressStart +
        ((i + 1) / framesManifest.length) * (progressEnd - progressStart)
    )
    await job.updateProgress(progress)

    // ~2s between frames (total: 14 * ~2.5s = ~35s)
    const frameDelay = 1500 + Math.floor(Math.random() * 1000)
    await sleep(frameDelay)
  }

  /* ======================================================================== */
  /*  Phase 3 — Report summary                                                */
  /* ======================================================================== */

  let reportContent = ""
  try {
    reportContent = await readFile(join(basePath, "report.md"), "utf-8")
  } catch {
    reportContent = "(Report not available)"
  }

  await pacedLog(
    projectId,
    "[App Behaviour] Generating analysis report...",
    500
  )

  // Extract executive summary (first ~500 chars of actual content)
  const lines = reportContent.split("\n").filter((l) => l.trim().length > 0)
  let summaryExcerpt = ""
  let inSummary = false
  for (const line of lines) {
    if (line.includes("Executive Summary")) {
      inSummary = true
      continue
    }
    if (inSummary) {
      if (line.startsWith("## ") || line.startsWith("---")) break
      summaryExcerpt += line + " "
      if (summaryExcerpt.length > 500) break
    }
  }
  summaryExcerpt = summaryExcerpt.trim()
  if (summaryExcerpt.length > 500) {
    summaryExcerpt = summaryExcerpt.slice(0, 500) + "..."
  }

  if (summaryExcerpt) {
    await pacedLog(
      projectId,
      `[App Behaviour] Report: ${summaryExcerpt.slice(0, 200)}...`,
      400
    )
  }

  const totalIssues = screens.reduce(
    (sum, s) => sum + (s.issues?.length ?? 0),
    0
  )
  const screensWithProposals = screens.filter((s) => s.nextjs_proposal)
  const totalFeatures = screensWithProposals.reduce(
    (sum, s) => sum + (s.nextjs_proposal?.features?.length ?? 0),
    0
  )
  await pacedLog(
    projectId,
    `[App Behaviour] Full report: ${bugs.length} bugs across ${screens.length} screens, ${totalFeatures} proposed features, ${verticalSlices.length} vertical slices`,
    300
  )
  await pacedLog(
    projectId,
    "[App Behaviour] Behavioral analysis complete.",
    300
  )

  /* ======================================================================== */
  /*  Return structured data for Config View                                   */
  /* ======================================================================== */

  return {
    knowledge: {
      statistics: {
        total_screens: screens.length,
        total_tasks: bugs.length,
        total_actions: totalIssues,
        total_transitions: navItems.length,
      },
      screens: screens.map((s) => ({
        screen_id: s.id,
        name: s.name,
        description: s.current_state?.layout ?? "",
        visual_elements:
          s.current_state?.components?.map((c) => c.type) ?? [],
      })),
      transitions: navItems.map((item) => ({
        from_screen: "sidebar",
        to_screen: item.screen,
        trigger_action: "click",
        description: `Navigate to ${item.label}`,
      })),
      business_functions: verticalSlices.map((vs) => ({
        name: vs.name,
        description: vs.description,
      })),
    },
    // Vertical slices as business functions — each is a user-facing feature, not a platform layer
    businessFunctions: verticalSlices.map((vs) => ({
      name: vs.name,
      description: vs.description,
      route: vs.route,
      issues: vs.issues,
      features: vs.features,
      bugs: vs.bugs,
      type: vs.type,
    })),
    contracts: screensWithProposals.map((s) => ({
      name: s.name,
      route: s.nextjs_proposal!.route,
      features: s.nextjs_proposal!.features?.length ?? 0,
    })),
    bugSummary: {
      total: bugs.length,
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
    },
    report: reportContent,
    bugs,
    frames: framesManifest,
  }
}
