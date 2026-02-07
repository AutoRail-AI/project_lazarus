"use client"

import { Building2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth/client"

interface TeamDetailClientProps {
  slug: string
}

export function TeamDetailClient({ slug }: TeamDetailClientProps) {
  const [org, setOrg] = useState<{ name: string; slug: string } | null | undefined>(undefined)

  useEffect(() => {
    authClient.organization
      .getFullOrganization({ query: { organizationSlug: slug } })
      .then(({ data }) => {
        setOrg(data ? { name: data.name, slug: data.slug } : null)
      })
      .catch(() => setOrg(null))
  }, [slug])

  if (org === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (org === null) {
    return (
      <Card className="glass-card border-border">
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-foreground">Organization not found or you don’t have access.</p>
          <Link href="/teams" className="text-sm text-primary hover:underline mt-2 inline-block">
            Back to teams
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-1">
        <h1 className="font-grotesk text-lg font-semibold text-foreground">
          {org.name}
        </h1>
        <p className="text-sm text-foreground mt-0.5">
          Organization workspace
        </p>
      </div>

      <Card className="glass-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sidebar-accent p-2">
              <Building2 className="h-5 w-5 text-electric-cyan" />
            </div>
            <div>
              <p className="font-grotesk text-sm font-medium text-foreground">
                {org.name}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {org.slug}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Team members and settings can be managed here in a future update.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
