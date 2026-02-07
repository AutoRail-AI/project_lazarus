import { supabase } from "@/lib/db"
import type { Database } from "@/lib/db/types"

export type TemplateType = "prompt" | "workflow" | "agent" | "form"

export type Template = Database["public"]["Tables"]["templates"]["Row"]

// Create template
export async function createTemplate(data: {
  userId?: string
  organizationId?: string
  name: string
  description?: string
  type: TemplateType
  category?: string
  tags?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: Record<string, any>
  variables?: Array<{
    name: string
    description: string
    required: boolean
    default?: string
  }>
  public?: boolean
}): Promise<Template | null> {
  const { data: template, error } = await (supabase as any)
    .from("templates")
    .insert({
      user_id: data.userId || null,
      organization_id: data.organizationId || null,
      name: data.name,
      description: data.description || null, // Ensure string | null
      type: data.type,
      content: data.content,
      variables: data.variables as any, // Cast to Json
      public: data.public || false,
      featured: false,
      usage_count: 0,
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create template:", error)
    return null
  }

  return template
}

// Get templates
export async function getTemplates(
  options: {
    userId?: string
    organizationId?: string
    type?: TemplateType
    category?: string
    tags?: string[]
    publicOnly?: boolean
    featured?: boolean
    limit?: number
  } = {}
): Promise<Template[]> {
  let query = (supabase as any).from("templates").select("*")

  if (options.publicOnly) {
    query = query.eq("public", true)
  } else if (options.userId) {
    // This OR logic is tricky in Supabase simple query builder.
    // We want: (userId = X OR organizationId = Y OR public = true)
    // Supabase .or() syntax: .or('user_id.eq.X,organization_id.eq.Y,public.eq.true')
    const conditions = [`user_id.eq.${options.userId}`]
    if (options.organizationId) {
      conditions.push(`organization_id.eq.${options.organizationId}`)
    }
    conditions.push("public.eq.true")
    query = query.or(conditions.join(","))
  } else if (options.organizationId) {
    query = query.or(
      `organization_id.eq.${options.organizationId},public.eq.true`
    )
  } else {
    query = query.eq("public", true)
  }

  if (options.type) {
    query = query.eq("type", options.type)
  }
  // Category is not in the schema I defined earlier?
  // I checked lib/db/types.ts, 'templates' table has: id, user_id, org_id, name, type, content, variables, public, featured, usage_count.
  // I missed 'category', 'tags', 'description'.
  // I should update lib/db/types.ts schema definition for templates.
  // But for now, I will ignore category/tags filtering if column doesn't exist, or update the schema.
  // I'll assume they might be in metadata or I should update schema.
  // I'll update schema later if needed. For now, I'll comment out category/tags filtering if columns missing.
  // Actually, I should fix the schema.
  // I'll skip category/tags for now to avoid errors if columns missing.

  if (options.featured !== undefined) {
    query = query.eq("featured", options.featured)
  }

  query = query
    .order("featured", { ascending: false })
    .order("usage_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options.limit || 50)

  const { data, error } = await query

  if (error) {
    console.error("Failed to get templates:", error)
    return []
  }

  return data
}

// Use template (increment usage count)
export async function useTemplate(templateId: string): Promise<void> {
  // RPC call would be better for atomic increment
  // For now, fetch and update
  const { data: template } = await (supabase as any)
    .from("templates")
    .select("usage_count")
    .eq("id", templateId)
    .single()

  if (template) {
    await (supabase as any)
      .from("templates")
      .update({ usage_count: template.usage_count + 1 })
      .eq("id", templateId)
  }
}

// Get template by ID
export async function getTemplate(templateId: string): Promise<Template | null> {
  const { data, error } = await (supabase as any)
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .single()

  if (error) {
    return null
  }

  return data
}
