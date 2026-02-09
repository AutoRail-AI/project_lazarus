import type { Database, SliceStatus } from "@/lib/db/types"

export type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]
export type Project = Database["public"]["Tables"]["projects"]["Row"]

export type PlanView = "graph" | "list"

export interface PlanFilters {
  search: string
  statuses: SliceStatus[]
}

export interface PlanState {
  view: PlanView
  filters: PlanFilters
  selectedSliceId: string | null
  focusedSliceId: string | null
  detailOpen: boolean
}

export type PlanAction =
  | { type: "SET_VIEW"; view: PlanView }
  | { type: "SET_FILTERS"; filters: Partial<PlanFilters> }
  | { type: "SELECT_SLICE"; sliceId: string }
  | { type: "CLEAR_SELECTION" }
  | { type: "OPEN_DETAIL" }
  | { type: "CLOSE_DETAIL" }
  | { type: "SET_FOCUSED_SLICE"; sliceId: string | null }
