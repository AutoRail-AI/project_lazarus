import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { TeamsContent } from "./_components/teams-content"

export default function TeamsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 animate-fade-in">
      <div className="space-y-1">
        <h1 className="font-grotesk text-lg font-semibold text-foreground">
          Teams
        </h1>
        <p className="text-sm text-foreground mt-0.5">
          Manage your organizations and team members.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-lg glass-card" />}>
        <TeamsContent />
      </Suspense>
    </div>
  )
}
