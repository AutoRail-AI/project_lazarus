"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"

interface QueryProviderProps {
  children: ReactNode
}

/**
 * React Query provider for client-side data fetching.
 * Uses lazy initialization to avoid sharing state between requests in SSR.
 * Reference: docs/IMPLEMENTATION_PART3.md Phase 7.3
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
