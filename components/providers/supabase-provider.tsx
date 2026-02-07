"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createContext, useContext, useMemo } from "react"
import { getSupabaseBrowserClient } from "@/lib/db/supabase-browser"
import type { Database } from "@/lib/db/types"

const SupabaseContext = createContext<SupabaseClient<Database> | null>(null)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => {
    try {
      return getSupabaseBrowserClient()
    } catch (error) {
      console.error("Failed to initialize Supabase client:", error)
      return null
    }
  }, [])

  return (
    <SupabaseContext.Provider value={client}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useSupabase() {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error("useSupabase must be used within a SupabaseProvider")
  }
  return context
}
