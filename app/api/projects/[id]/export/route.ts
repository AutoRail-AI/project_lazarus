import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

/* -------------------------------------------------------------------------- */
/*  Markdown generation                                                        */
/* -------------------------------------------------------------------------- */

interface CodeContract {
  files?: Array<{ path?: string; action?: string; description?: string }>
  implementation_steps?: Array<{ title?: string; details?: string }>
  key_decisions?: string[]
  pseudo_code?: string
  verification?: string[]
}

interface BehavioralContract {
  user_flows?: string[]
  inputs?: string[]
  expected_outputs?: string[]
  visual_assertions?: string[]
}

interface ModernizationFlags {
  uses_server_components?: boolean
  uses_api_routes?: boolean
  uses_database?: boolean
  uses_auth?: boolean
  uses_realtime?: boolean
}

function generateMarkdown(project: Project, slices: Slice[]): string {
  const lines: string[] = []

  // Title
  lines.push(`# ${project.name} — Implementation Plan`)
  lines.push("")
  lines.push(
    `> Auto-generated migration plan. ${slices.length} vertical slice${slices.length !== 1 ? "s" : ""}, ordered by dependency.`
  )
  if (project.description) {
    lines.push(`>`)
    lines.push(`> ${project.description}`)
  }
  lines.push("")
  lines.push(`**Target Framework:** ${project.target_framework || "Next.js"}`)
  lines.push(`**Generated:** ${new Date().toISOString().split("T")[0]}`)
  lines.push("")
  lines.push("---")
  lines.push("")

  // Table of contents
  lines.push("## Table of Contents")
  lines.push("")
  for (const slice of slices) {
    const anchor = slice.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    lines.push(
      `${slice.priority}. [${slice.name}](#${anchor})`
    )
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Each slice as a phase
  for (const slice of slices) {
    const anchor = slice.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    lines.push(`<a id="${anchor}"></a>`)
    lines.push(`## Phase ${slice.priority}: ${slice.name}`)
    lines.push("")

    // Description
    if (slice.description) {
      lines.push(slice.description)
      lines.push("")
    }

    // Dependencies
    const deps = (slice.dependencies ?? []) as string[]
    if (deps.length > 0) {
      lines.push(`**Depends on:** ${deps.join(", ")}`)
      lines.push("")
    }

    // Modernization flags
    const flags = slice.modernization_flags as ModernizationFlags | null
    if (flags && typeof flags === "object") {
      const active = Object.entries(flags)
        .filter(([, v]) => v === true)
        .map(([k]) => k.replace(/^uses_/, "").replace(/_/g, " "))
      if (active.length > 0) {
        lines.push(`**Uses:** ${active.join(", ")}`)
        lines.push("")
      }
    }

    // Behavioral contract
    const bc = slice.behavioral_contract as BehavioralContract | null
    if (bc && typeof bc === "object") {
      const hasContent =
        (bc.user_flows?.length ?? 0) > 0 ||
        (bc.inputs?.length ?? 0) > 0 ||
        (bc.expected_outputs?.length ?? 0) > 0 ||
        (bc.visual_assertions?.length ?? 0) > 0

      if (hasContent) {
        lines.push("### Behavioral Contract")
        lines.push("")

        if (bc.user_flows?.length) {
          lines.push("**User Flows:**")
          for (const flow of bc.user_flows) {
            lines.push(`- ${flow}`)
          }
          lines.push("")
        }
        if (bc.inputs?.length) {
          lines.push("**Inputs:**")
          for (const input of bc.inputs) {
            lines.push(`- ${input}`)
          }
          lines.push("")
        }
        if (bc.expected_outputs?.length) {
          lines.push("**Expected Outputs:**")
          for (const output of bc.expected_outputs) {
            lines.push(`- ${output}`)
          }
          lines.push("")
        }
        if (bc.visual_assertions?.length) {
          lines.push("**Visual Assertions:**")
          for (const assertion of bc.visual_assertions) {
            lines.push(`- ${assertion}`)
          }
          lines.push("")
        }
      }
    }

    // Code contract (the main implementation guide)
    const cc = slice.code_contract as CodeContract | null
    if (cc && typeof cc === "object") {
      // Files
      if (cc.files?.length) {
        lines.push("### Files")
        lines.push("")
        lines.push("| # | File | Action | Description |")
        lines.push("|---|------|--------|-------------|")
        cc.files.forEach((f, i) => {
          lines.push(
            `| ${i + 1} | \`${f.path ?? "?"}\` | ${f.action ?? "?"} | ${f.description ?? ""} |`
          )
        })
        lines.push("")
      }

      // Implementation steps
      if (cc.implementation_steps?.length) {
        lines.push("### Implementation Steps")
        lines.push("")
        for (const step of cc.implementation_steps) {
          lines.push(`#### ${step.title ?? "Step"}`)
          lines.push("")
          if (step.details) {
            lines.push(step.details)
            lines.push("")
          }
        }
      }

      // Key decisions
      if (cc.key_decisions?.length) {
        lines.push("### Key Decisions")
        lines.push("")
        for (const decision of cc.key_decisions) {
          lines.push(`- ${decision}`)
        }
        lines.push("")
      }

      // Pseudo code
      if (cc.pseudo_code) {
        lines.push("### Pseudo Code")
        lines.push("")
        lines.push("```typescript")
        lines.push(cc.pseudo_code)
        lines.push("```")
        lines.push("")
      }

      // Verification checklist
      if (cc.verification?.length) {
        lines.push("### Verification Checklist")
        lines.push("")
        for (const item of cc.verification) {
          lines.push(`- [ ] ${item}`)
        }
        lines.push("")
      }
    }

    lines.push("---")
    lines.push("")
  }

  return lines.join("\n")
}

/* -------------------------------------------------------------------------- */
/*  Route handler                                                              */
/* -------------------------------------------------------------------------- */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: project, error: projectError } = (await (supabase as any)
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", session.user.id)
    .single()) as { data: Project | null; error: unknown }

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const { data: slices } = (await (supabase as any)
    .from("vertical_slices")
    .select("*")
    .eq("project_id", projectId)
    .order("priority", { ascending: true })) as { data: Slice[] | null }

  if (!slices || slices.length === 0) {
    return NextResponse.json(
      { error: "No slices found. Run analysis first." },
      { status: 404 }
    )
  }

  const markdown = generateMarkdown(project, slices)

  const safeName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-implementation-plan.md"`,
    },
  })
}
