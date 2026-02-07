"use client"

import { Building2, Plus } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { CreateOrgForm } from "@/components/organizations/create-org-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth/client"

type Org = { id: string; name: string; slug: string }

export function TeamsContent() {
  const searchParams = useSearchParams()
  const openCreate = searchParams.get("create") === "1"
  const [orgs, setOrgs] = useState<Org[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(openCreate)

  useEffect(() => {
    if (openCreate) setCreateOpen(true)
  }, [openCreate])

  useEffect(() => {
    let cancelled = false
    authClient.organization.list().then(({ data }) => {
      if (!cancelled) {
        setOrgs(data ?? [])
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-rail-fade hover:opacity-90 transition-opacity shadow-glow-purple">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create organization
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-grotesk text-lg font-semibold">
                Create organization
              </DialogTitle>
            </DialogHeader>
            <CreateOrgForm />
          </DialogContent>
        </Dialog>
      </div>

      {!orgs || orgs.length === 0 ? (
        <Card className="glass-panel border-dashed border-border bg-card/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-rail-purple/10 p-4 mb-4">
              <Building2 className="h-8 w-8 text-rail-purple" />
            </div>
            <h3 className="font-grotesk text-sm font-semibold text-foreground mb-2">
              No organizations yet
            </h3>
            <p className="text-sm text-foreground max-w-sm mb-6">
              Create an organization to collaborate with your team and scope projects.
            </p>
            <Button
              size="sm"
              className="bg-rail-fade hover:opacity-90 transition-opacity shadow-glow-purple"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create organization
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Card
              key={org.id}
              className="glass-card border-border hover:glow-purple transition-all"
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-sidebar-accent p-2 shrink-0">
                    <Building2 className="h-5 w-5 text-electric-cyan" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-grotesk text-sm font-medium text-foreground truncate">
                      {org.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {org.slug}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button variant="outline" size="sm" asChild className="w-full border-border">
                    <Link href={`/teams/${org.slug}`}>View team</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
