"use client"

import { type ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { AnalyticsProvider } from "./analytics-provider"
import { AuthProvider } from "./auth-provider"
import { QueryProvider } from "./query-provider"
import { SupabaseProvider } from "./supabase-provider"

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <QueryProvider>
        <SupabaseProvider>
          <AnalyticsProvider>
            {children}
            <Toaster position="top-right" richColors />
          </AnalyticsProvider>
        </SupabaseProvider>
      </QueryProvider>
    </AuthProvider>
  )
}

export { AuthProvider, useAuth } from "./auth-provider"
export { QueryProvider } from "./query-provider"
export { SupabaseProvider, useSupabase } from "./supabase-provider"
