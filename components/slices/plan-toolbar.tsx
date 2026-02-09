"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Download,
  Filter,
  LayoutList,
  Network,
  PanelLeft,
  PanelLeftClose,
  Search,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { SliceStatus } from "@/lib/db/types"
import type { PlanView } from "./plan-types"

const ALL_STATUSES: SliceStatus[] = [
  "pending",
  "selected",
  "building",
  "testing",
  "self_healing",
  "complete",
  "failed",
]

const STATUS_LABELS: Record<SliceStatus, string> = {
  pending: "Pending",
  selected: "Selected",
  building: "Building",
  testing: "Testing",
  self_healing: "Self-Healing",
  complete: "Complete",
  failed: "Failed",
}

interface PlanToolbarProps {
  projectId: string
  view: PlanView
  onViewChange: (view: PlanView) => void
  search: string
  onSearchChange: (search: string) => void
  statuses: SliceStatus[]
  onStatusesChange: (statuses: SliceStatus[]) => void
  onBuildNext: () => void
  buildableCount: number
  filteredCount: number
  totalCount: number
  sidebarOpen: boolean
  onSidebarToggle: () => void
}

export function PlanToolbar({
  projectId,
  view,
  onViewChange,
  search,
  onSearchChange,
  statuses,
  onStatusesChange,
  onBuildNext,
  buildableCount,
  filteredCount,
  totalCount,
  sidebarOpen,
  onSidebarToggle,
}: PlanToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearchChange(value)
      }, 200)
    },
    [onSearchChange]
  )

  const toggleStatus = useCallback(
    (status: SliceStatus) => {
      const next = statuses.includes(status)
        ? statuses.filter((s) => s !== status)
        : [...statuses, status]
      onStatusesChange(next)
    },
    [statuses, onStatusesChange]
  )

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {/* Sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onSidebarToggle}
        className="h-8 w-8 shrink-0"
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-4 w-4" />
        ) : (
          <PanelLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Search */}
      <div className="relative max-w-xs flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search slices..."
          className="h-8 pl-8 text-sm"
        />
      </div>

      {/* Status filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Status
            {statuses.length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rail-purple text-[10px] text-white">
                {statuses.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {ALL_STATUSES.map((s) => (
            <DropdownMenuCheckboxItem
              key={s}
              checked={statuses.includes(s)}
              onCheckedChange={() => toggleStatus(s)}
            >
              {STATUS_LABELS[s]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      {/* Count */}
      <span className="text-xs text-muted-foreground">
        {filteredCount} of {totalCount}
      </span>

      {/* View toggle */}
      <div className="flex items-center rounded-md border border-border p-0.5">
        <button
          type="button"
          onClick={() => onViewChange("graph")}
          className={cn(
            "rounded-sm p-1.5 transition-colors",
            view === "graph"
              ? "bg-rail-purple/20 text-quantum-violet"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Network className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("list")}
          className={cn(
            "rounded-sm p-1.5 transition-colors",
            view === "list"
              ? "bg-rail-purple/20 text-quantum-violet"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutList className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Export */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => window.open(`/api/projects/${projectId}/export`, "_blank")}
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </Button>

      {/* Build Next */}
      <Button
        size="sm"
        className="h-8 gap-1.5 bg-rail-fade text-white hover:opacity-90"
        disabled={buildableCount === 0}
        onClick={onBuildNext}
      >
        <Zap className="h-3.5 w-3.5" />
        Build Next
      </Button>
    </div>
  )
}
