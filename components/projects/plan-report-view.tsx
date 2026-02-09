"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Database,
  FileText,
  Globe,
  Lock,
  Server,
  Zap,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { SliceStatusBadge } from "@/components/slices/slice-status-badge"
import { cn } from "@/lib/utils"
import type { Database as DB } from "@/lib/db/types"

type Slice = DB["public"]["Tables"]["vertical_slices"]["Row"]

/* -------------------------------------------------------------------------- */
/*  Types for parsed slice JSON fields                                         */
/* -------------------------------------------------------------------------- */

interface FileEntry {
  path: string
  action: string
  description?: string
}

interface ImplStep {
  title: string
  details: string
}

interface CodeContract {
  files?: FileEntry[]
  implementation_steps?: ImplStep[]
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

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parseJson<T>(val: unknown): T | null {
  if (!val) return null
  if (typeof val === "object") return val as T
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T
    } catch {
      return null
    }
  }
  return null
}

const FLAG_LABELS: Array<{
  key: keyof ModernizationFlags
  label: string
  icon: React.ElementType
}> = [
  { key: "uses_server_components", label: "Server Components", icon: Server },
  { key: "uses_api_routes", label: "API Routes", icon: Globe },
  { key: "uses_database", label: "Database", icon: Database },
  { key: "uses_auth", label: "Auth", icon: Lock },
  { key: "uses_realtime", label: "Realtime", icon: Zap },
]

/* -------------------------------------------------------------------------- */
/*  Simple syntax highlighting for pseudo-code                                 */
/* -------------------------------------------------------------------------- */

function highlightCode(code: string): React.ReactNode[] {
  const lines = code.split("\n")
  return lines.map((line, i) => {
    let highlighted = line
      // Comments
      .replace(
        /(\/\/.*$)/gm,
        '<span class="text-muted-foreground/60 italic">$1</span>'
      )
      // Strings
      .replace(
        /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        '<span class="text-green-400">$1</span>'
      )
      // Keywords
      .replace(
        /\b(import|export|from|const|let|var|function|async|await|return|if|else|for|of|in|new|throw|try|catch|type|interface|class|extends|implements|default|switch|case|break)\b/g,
        '<span class="text-quantum-violet font-medium">$1</span>'
      )
      // Types
      .replace(
        /\b(string|number|boolean|void|null|undefined|any|never|unknown|Promise|Array|Record|Partial)\b/g,
        '<span class="text-electric-cyan">$1</span>'
      )
    return (
      <div key={i} className="leading-relaxed">
        <span className="mr-4 inline-block w-8 select-none text-right text-muted-foreground/40">
          {i + 1}
        </span>
        <span dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    )
  })
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function FilesTable({ files }: { files: FileEntry[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 w-10 px-3 text-xs">#</TableHead>
            <TableHead className="h-9 px-3 text-xs">File</TableHead>
            <TableHead className="h-9 w-20 px-3 text-xs">Action</TableHead>
            <TableHead className="h-9 px-3 text-xs">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((f, i) => (
            <TableRow key={i} className="border-border/30">
              <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                {i + 1}
              </TableCell>
              <TableCell className="px-3 py-2">
                <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs font-mono text-electric-cyan">
                  {f.path}
                </code>
              </TableCell>
              <TableCell className="px-3 py-2">
                <span
                  className={cn(
                    "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    f.action === "create"
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning"
                  )}
                >
                  {f.action}
                </span>
              </TableCell>
              <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                {f.description ?? ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ImplementationSteps({ steps }: { steps: ImplStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div
          key={i}
          className="rounded-lg border border-border/40 bg-card/20 p-3"
        >
          <div className="mb-1 flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-electric-cyan/15 text-[10px] font-bold text-electric-cyan">
              {i + 1}
            </span>
            <h4 className="text-sm font-semibold text-foreground">
              {step.title}
            </h4>
          </div>
          <p className="ml-7 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {step.details}
          </p>
        </div>
      ))}
    </div>
  )
}

function PseudoCodeBlock({ code }: { code: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/40 bg-[#0d1117] p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
        <Code2 className="h-3 w-3" />
        TypeScript
      </div>
      <pre className="font-mono text-xs text-foreground/80">
        {highlightCode(code)}
      </pre>
    </div>
  )
}

function VerificationChecklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const toggle = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => toggle(i)}
          className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-card/30"
        >
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
              checked.has(i)
                ? "border-success bg-success/20 text-success"
                : "border-muted-foreground/40 text-transparent"
            )}
          >
            <Check className="h-3 w-3" />
          </span>
          <span
            className={cn(
              "text-xs",
              checked.has(i)
                ? "text-muted-foreground line-through"
                : "text-foreground/80"
            )}
          >
            {item}
          </span>
        </button>
      ))}
    </div>
  )
}

function BehavioralContractPanel({
  contract,
}: {
  contract: BehavioralContract
}) {
  const sections = [
    { label: "User Flows", items: contract.user_flows },
    { label: "Inputs", items: contract.inputs },
    { label: "Expected Outputs", items: contract.expected_outputs },
    { label: "Visual Assertions", items: contract.visual_assertions },
  ]

  return (
    <div className="rounded-lg border border-quantum-violet/20 bg-quantum-violet/5 p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-quantum-violet">
        Behavioral Contract
      </h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((sec) =>
          sec.items && sec.items.length > 0 ? (
            <div key={sec.label}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {sec.label}
              </p>
              <ul className="space-y-1">
                {sec.items.map((item, i) => (
                  <li
                    key={i}
                    className="text-xs leading-relaxed text-foreground/70"
                  >
                    <span className="mr-1.5 text-quantum-violet/60">-</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

function ModernizationBadges({ flags }: { flags: ModernizationFlags }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FLAG_LABELS.map(({ key, label, icon: Icon }) =>
        flags[key] ? (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full border border-electric-cyan/20 bg-electric-cyan/10 px-2 py-0.5 text-[10px] font-medium text-electric-cyan"
          >
            <Icon className="h-2.5 w-2.5" />
            {label}
          </span>
        ) : null
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Phase Section (collapsible)                                                */
/* -------------------------------------------------------------------------- */

function PhaseSection({
  slice,
  index,
  sectionRef,
}: {
  slice: Slice
  index: number
  sectionRef: (el: HTMLDivElement | null) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  const code = parseJson<CodeContract>(slice.code_contract)
  const behavioral = parseJson<BehavioralContract>(slice.behavioral_contract)
  const flags = parseJson<ModernizationFlags>(slice.modernization_flags)
  const deps = (slice.dependencies as string[] | null) ?? []

  return (
    <section ref={sectionRef} id={`phase-${index + 1}`} className="scroll-mt-6">
      {/* Phase header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="group flex items-center gap-2 text-left"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-electric-cyan/15 text-xs font-bold text-electric-cyan">
              {index + 1}
            </span>
            <h3 className="font-grotesk text-lg font-semibold text-foreground group-hover:text-electric-cyan transition-colors">
              {slice.name}
            </h3>
            {collapsed ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {slice.description && (
            <p className="mt-1 ml-9 text-sm leading-relaxed text-muted-foreground">
              {slice.description}
            </p>
          )}
        </div>
        <SliceStatusBadge status={slice.status} size="sm" />
      </div>

      {/* Meta row */}
      {!collapsed && (
        <div className="mt-3 ml-9 flex flex-wrap items-center gap-3">
          {deps.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Depends on:{" "}
              {deps.map((d, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span className="font-medium text-foreground/70">{d}</span>
                </span>
              ))}
            </span>
          )}
          {flags && <ModernizationBadges flags={flags} />}
        </div>
      )}

      {/* Content */}
      {!collapsed && code && (
        <div className="mt-4 ml-9 space-y-5">
          {/* Files table */}
          {code.files && code.files.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3 w-3" />
                Files ({code.files.length})
              </h4>
              <FilesTable files={code.files} />
            </div>
          )}

          {/* Implementation steps */}
          {code.implementation_steps && code.implementation_steps.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Implementation Steps
              </h4>
              <ImplementationSteps steps={code.implementation_steps} />
            </div>
          )}

          {/* Key decisions */}
          {code.key_decisions && code.key_decisions.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Key Decisions
              </h4>
              <ul className="space-y-1 ml-1">
                {code.key_decisions.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs leading-relaxed text-foreground/80"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-electric-cyan/60" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pseudo code */}
          {code.pseudo_code && code.pseudo_code.trim().length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pseudo Code
              </h4>
              <PseudoCodeBlock code={code.pseudo_code} />
            </div>
          )}

          {/* Verification checklist */}
          {code.verification && code.verification.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Verification Checklist
              </h4>
              <VerificationChecklist items={code.verification} />
            </div>
          )}

          {/* Behavioral contract */}
          {behavioral && <BehavioralContractPanel contract={behavioral} />}
        </div>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                             */
/* -------------------------------------------------------------------------- */

interface PlanReportViewProps {
  projectName: string
  targetFramework: string | null
  slices: Slice[]
}

export function PlanReportView({
  projectName,
  targetFramework,
  slices,
}: PlanReportViewProps) {
  const sorted = useMemo(
    () => [...slices].sort((a, b) => a.priority - b.priority),
    [slices]
  )

  // IntersectionObserver for TOC active tracking
  const [activePhase, setActivePhase] = useState(0)
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useEffect(() => {
    const refs = sectionRefs.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-phase-idx"))
            if (!isNaN(idx)) setActivePhase(idx)
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    )

    for (const [, el] of Array.from(refs.entries())) {
      observer.observe(el)
    }

    return () => observer.disconnect()
  }, [sorted.length])

  const setSectionRef = (idx: number) => (el: HTMLDivElement | null) => {
    if (el) {
      el.setAttribute("data-phase-idx", String(idx))
      sectionRefs.current.set(idx, el)
    } else {
      sectionRefs.current.delete(idx)
    }
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Sticky TOC sidebar */}
      <nav className="hidden w-52 shrink-0 overflow-y-auto border-r border-border/30 py-4 pr-3 pl-1 lg:block">
        <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Phases
        </p>
        <div className="space-y-0.5">
          {sorted.map((slice, i) => (
            <a
              key={slice.id}
              href={`#phase-${i + 1}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                activePhase === i
                  ? "bg-electric-cyan/10 text-electric-cyan font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/30"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold",
                  activePhase === i
                    ? "bg-electric-cyan/20 text-electric-cyan"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                {i + 1}
              </span>
              <span className="truncate">{slice.name}</span>
            </a>
          ))}
        </div>
      </nav>

      {/* Scrollable document body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {/* Document header */}
        <div className="mb-6">
          <h2 className="font-grotesk text-xl font-bold text-foreground">
            Migration Plan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {projectName}
            {targetFramework ? ` \u2192 ${targetFramework}` : ""}
            {" \u00B7 "}
            {sorted.length} phase{sorted.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Phase sections */}
        <div className="space-y-8">
          {sorted.map((slice, i) => (
            <div key={slice.id}>
              <PhaseSection
                slice={slice}
                index={i}
                sectionRef={setSectionRef(i)}
              />
              {i < sorted.length - 1 && <Separator className="mt-8" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
