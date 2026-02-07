"use client"

import { Building2, ChevronsUpDown, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth/client"

export function OrgSwitcher() {
  const router = useRouter()
  const { data: activeOrg, isPending: activePending } = authClient.useActiveOrganization()
  const [orgs, setOrgs] = useState<{ id: string; name: string; slug: string }[] | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [open, setOpen] = useState(false)

  const loadOrgs = useCallback(async () => {
    if (orgs !== null) return
    setLoadingList(true)
    const { data } = await authClient.organization.list()
    setOrgs(data ?? [])
    setLoadingList(false)
  }, [orgs])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) loadOrgs()
  }

  const setActive = async (organizationId: string | null) => {
    await authClient.organization.setActive({ organizationId })
    setOpen(false)
    router.refresh()
  }

  const label = activePending
    ? "Loading..."
    : activeOrg?.name ?? "Personal"

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Switch organization"
          className="flex w-full items-center justify-between gap-2 px-3 py-2 h-9 font-medium text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">{label}</span>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 border-sidebar-border bg-sidebar text-sidebar-foreground"
        align="start"
        side="right"
        sideOffset={8}
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Switch organization
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-sidebar-border" />
        <DropdownMenuItem
          className="focus:bg-sidebar-accent focus:text-sidebar-foreground cursor-pointer"
          onClick={() => setActive(null)}
        >
          <Building2 className="mr-2 h-4 w-4" />
          Personal
        </DropdownMenuItem>
        {loadingList ? (
          <div className="flex items-center justify-center py-4">
            <Spinner className="h-4 w-4" />
          </div>
        ) : (
          (orgs ?? []).map((org) => (
            <DropdownMenuItem
              key={org.id}
              className="focus:bg-sidebar-accent focus:text-sidebar-foreground cursor-pointer"
              onClick={() => setActive(org.id)}
            >
              <Building2 className="mr-2 h-4 w-4" />
              <span className="truncate">{org.name}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator className="bg-sidebar-border" />
        <DropdownMenuItem
          asChild
          className="focus:bg-sidebar-accent focus:text-sidebar-foreground"
        >
          <Link href="/teams?create=1">
            <Plus className="mr-2 h-4 w-4" />
            Create organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
