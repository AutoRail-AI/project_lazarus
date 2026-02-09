import { ArrowLeft, Building2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TeamDetailClient } from "./_components/team-detail-client"

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/teams">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Back to teams
          </Link>
        </Button>
      </div>

      <TeamDetailClient slug={slug} />
    </div>
  )
}
