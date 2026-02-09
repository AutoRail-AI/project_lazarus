"use client"

import { useCallback, useState } from "react"
import { motion } from "framer-motion"
import { Zap } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ChaosButtonProps {
  projectId: string
  sliceId?: string | null
}

export function ChaosButton({ projectId, sliceId }: ChaosButtonProps) {
  const [injecting, setInjecting] = useState(false)
  const [open, setOpen] = useState(false)

  const injectChaos = useCallback(async () => {
    setInjecting(true)
    setOpen(false)

    const baseBody = {
      project_id: projectId,
      ...(sliceId ? { slice_id: sliceId } : {}),
    }

    const mockEvents = [
      {
        ...baseBody,
        event_type: "test_result" as const,
        content: "TypeError: Cannot read properties of undefined (reading 'map'). Expected array but received null from API response.",
        metadata: { passed: false, result: "fail", file: "src/components/DataGrid.test.tsx" },
        confidence_delta: -0.05,
      },
      {
        ...baseBody,
        event_type: "self_heal" as const,
        content: "Root cause identified: API response shape changed after schema migration. The data field is now nested under a 'results' key. Applying null-safe access pattern and response normalizer.",
        metadata: {},
        confidence_delta: -0.02,
      },
      {
        ...baseBody,
        event_type: "code_write" as const,
        content: "// Fix: normalize API response shape\nconst normalize = (res: ApiResponse) => ({\n  data: res.results ?? res.data ?? [],\n  total: res.total ?? 0,\n});\n\nexport function DataGrid({ endpoint }: Props) {\n  const { data } = useSWR(endpoint, fetcher);\n  const normalized = normalize(data);\n  return normalized.data.map(row => <Row key={row.id} {...row} />);\n}",
        metadata: { filename: "src/components/DataGrid.tsx", language: "typescript" },
        confidence_delta: 0,
      },
      {
        ...baseBody,
        event_type: "test_result" as const,
        content: "All 12 tests passing after fix. DataGrid correctly handles both old and new API response shapes.",
        metadata: { passed: true, result: "pass", file: "src/components/DataGrid.test.tsx" },
        confidence_delta: 0.08,
      },
    ]

    const delays = [0, 800, 1600, 2400]

    for (let i = 0; i < mockEvents.length; i++) {
      const event = mockEvents[i]
      const delay = delays[i] ?? 0
      if (!event) continue

      await new Promise<void>((resolve) => setTimeout(resolve, delay))

      try {
        await fetch(`/api/projects/${projectId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        })
      } catch {
        // Silently fail
      }
    }

    setInjecting(false)
  }, [projectId, sliceId])

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <motion.button
          type="button"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning/5 px-3 py-2 backdrop-blur-sm transition-colors hover:bg-warning/10"
          whileHover={{ x: [-2, 2, -2, 0] }}
          transition={{ duration: 0.3 }}
          disabled={injecting}
        >
          <Zap className={injecting ? "h-4 w-4 animate-pulse text-warning" : "h-4 w-4 text-warning"} />
          <span className="font-grotesk text-[10px] uppercase tracking-wider text-warning">
            {injecting ? "Injecting..." : "Chaos"}
          </span>
        </motion.button>
      </AlertDialogTrigger>

      <AlertDialogContent className="border-border bg-background/95">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 font-grotesk text-foreground">
            <Zap className="h-5 w-5 text-warning" />
            Inject Chaos?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Simulate a bug for the agent to self-heal. This will inject a test
            failure, diagnosis, code fix, and passing test into the event stream
            to demonstrate the self-healing loop.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={injectChaos}
            className="bg-warning/20 text-warning hover:bg-warning/30"
          >
            Inject Chaos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
