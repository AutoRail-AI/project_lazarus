"use client"

import { useCallback, useEffect, useReducer } from "react"
import type { PlanAction, PlanState, PlanView } from "./plan-types"

const STORAGE_KEY = "lazarus-plan-view"

const initialState: PlanState = {
  view: "graph",
  filters: { search: "", statuses: [] },
  selectedSliceId: null,
  focusedSliceId: null,
  detailOpen: false,
}

function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, view: action.view, focusedSliceId: null }
    case "SET_FILTERS":
      return {
        ...state,
        filters: { ...state.filters, ...action.filters },
      }
    case "SELECT_SLICE":
      return {
        ...state,
        selectedSliceId: action.sliceId,
        detailOpen: true,
      }
    case "CLEAR_SELECTION":
      return {
        ...state,
        selectedSliceId: null,
        detailOpen: false,
        focusedSliceId: null,
      }
    case "OPEN_DETAIL":
      return { ...state, detailOpen: true }
    case "CLOSE_DETAIL":
      return { ...state, detailOpen: false }
    case "SET_FOCUSED_SLICE":
      return { ...state, focusedSliceId: action.sliceId }
    default:
      return state
  }
}

function getInitialState(): PlanState {
  if (typeof window === "undefined") return initialState
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "list" || stored === "graph") {
      return { ...initialState, view: stored as PlanView }
    }
  } catch {
    // localStorage unavailable
  }
  return initialState
}

export function usePlanState() {
  const [state, dispatch] = useReducer(planReducer, undefined, getInitialState)

  // Persist view preference
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, state.view)
    } catch {
      // localStorage unavailable
    }
  }, [state.view])

  const setView = useCallback(
    (view: PlanView) => dispatch({ type: "SET_VIEW", view }),
    []
  )
  const setSearch = useCallback(
    (search: string) => dispatch({ type: "SET_FILTERS", filters: { search } }),
    []
  )
  const setStatuses = useCallback(
    (statuses: PlanState["filters"]["statuses"]) =>
      dispatch({ type: "SET_FILTERS", filters: { statuses } }),
    []
  )
  const selectSlice = useCallback(
    (sliceId: string) => dispatch({ type: "SELECT_SLICE", sliceId }),
    []
  )
  const clearSelection = useCallback(
    () => dispatch({ type: "CLEAR_SELECTION" }),
    []
  )
  const closeDetail = useCallback(
    () => dispatch({ type: "CLOSE_DETAIL" }),
    []
  )
  const setFocusedSlice = useCallback(
    (sliceId: string | null) =>
      dispatch({ type: "SET_FOCUSED_SLICE", sliceId }),
    []
  )

  return {
    state,
    dispatch,
    setView,
    setSearch,
    setStatuses,
    selectSlice,
    clearSelection,
    closeDetail,
    setFocusedSlice,
  }
}
