"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Database, ProjectStatus } from "@/lib/db/types"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type Slice = Database["public"]["Tables"]["vertical_slices"]["Row"]

const ACTIVE_STATUSES: ProjectStatus[] = ["processing", "building", "paused"]
const SLICE_STATUSES: ProjectStatus[] = ["ready", "building", "paused", "complete"]
const POLL_INTERVAL = 3000

interface UseProjectPollingOptions {
  projectId: string
  initialProject: Project
  initialSlices: Slice[]
}

interface UseProjectPollingReturn {
  project: Project
  slices: Slice[]
  isPolling: boolean
  refetch: () => Promise<void>
}

export function useProjectPolling({
  projectId,
  initialProject,
  initialSlices,
}: UseProjectPollingOptions): UseProjectPollingReturn {
  const [project, setProject] = useState<Project>(initialProject)
  const [slices, setSlices] = useState<Slice[]>(initialSlices)
  const [isPolling, setIsPolling] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) return
      const data = (await res.json()) as Project
      if (data && data.id) {
        setProject(data)
      }
    } catch {
      // Silently fail - will retry on next poll
    }
  }, [projectId])

  const fetchSlices = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/slices`)
      if (!res.ok) return
      const data = (await res.json()) as Slice[]
      if (Array.isArray(data)) {
        setSlices(data)
      }
    } catch {
      // Silently fail
    }
  }, [projectId])

  const refetch = useCallback(async () => {
    await Promise.all([fetchProject(), fetchSlices()])
  }, [fetchProject, fetchSlices])

  // Start/stop polling based on project status
  useEffect(() => {
    const shouldPoll = ACTIVE_STATUSES.includes(project.status)
    const shouldFetchSlices = SLICE_STATUSES.includes(project.status)

    if (shouldPoll) {
      setIsPolling(true)
      intervalRef.current = setInterval(async () => {
        await fetchProject()
        if (shouldFetchSlices) {
          await fetchSlices()
        }
      }, POLL_INTERVAL)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = undefined
        }
        setIsPolling(false)
      }
    } else {
      setIsPolling(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }
  }, [project.status, fetchProject, fetchSlices])

  // When status transitions to a slice-fetching status, do an immediate slice fetch
  const prevStatusRef = useRef(project.status)
  useEffect(() => {
    if (
      prevStatusRef.current !== project.status &&
      SLICE_STATUSES.includes(project.status)
    ) {
      fetchSlices()
    }
    prevStatusRef.current = project.status
  }, [project.status, fetchSlices])

  return { project, slices, isPolling, refetch }
}
