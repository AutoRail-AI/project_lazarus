import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

export type SearchIndex = Database["public"]["Tables"]["search_index"]["Row"]

// Index a document
export async function indexDocument(data: {
  organizationId?: string
  resource: string
  resourceId: string
  title: string
  content: string
  tags?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
}): Promise<SearchIndex | null> {
  const { data: indexed, error } = await (supabase as any)
    .from("search_index")
    .upsert(
      {
        organization_id: data.organizationId,
        resource: data.resource,
        resource_id: data.resourceId,
        title: data.title,
        content: data.content,
        tags: data.tags,
        metadata: data.metadata,
      },
      { onConflict: "resource,resource_id" }
    )
    .select()
    .single()

  if (error) {
    console.error("Failed to index document:", error)
    return null
  }

  return indexed
}

// Remove from index
export async function removeFromIndex(
  resource: string,
  resourceId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from("search_index")
    .delete()
    .eq("resource", resource)
    .eq("resource_id", resourceId)

  if (error) {
    console.error("Failed to remove from index:", error)
  }
}

// Search
export async function search(
  query: string,
  options: {
    organizationId?: string
    resource?: string
    tags?: string[]
    limit?: number
  } = {}
): Promise<SearchIndex[]> {
  // Use simple search logic since we haven't set up full text search indexes in Postgres yet
  return simpleSearch(query, options)
}

// Simple text search (fallback if text index not available)
export async function simpleSearch(
  query: string,
  options: {
    organizationId?: string
    resource?: string
    tags?: string[]
    limit?: number
  } = {}
): Promise<SearchIndex[]> {
  let dbQuery = (supabase as any)
    .from("search_index")
    .select("*")
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .limit(options.limit || 20)

  if (options.organizationId) {
    dbQuery = dbQuery.eq("organization_id", options.organizationId)
  }
  if (options.resource) {
    dbQuery = dbQuery.eq("resource", options.resource)
  }
  if (options.tags && options.tags.length > 0) {
    dbQuery = dbQuery.contains("tags", options.tags)
  }

  const { data, error } = await dbQuery

  if (error) {
    console.error("Failed to search:", error)
    return []
  }

  return data
}
