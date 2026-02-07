import { supabase } from "@/lib/db"
import type { AgentTool } from "../types"

export const databaseTool: AgentTool = {
  name: "query_database",
  description: "Query the database for information. Use this to search for users, organizations, or other data.",
  parameters: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "The table name (e.g., 'user', 'organization', 'projects')",
      },
      filters: {
        type: "object",
        description: "Filter object (key-value pairs for equality check)",
      },
      limit: {
        type: "number",
        description: "Maximum number of results (default: 10)",
      },
    },
    required: ["table"],
  },
  handler: async ({ table, filters, limit = 10 }) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any).from(table).select("*").limit(limit)

      if (filters) {
        const filterObj = typeof filters === "string" ? JSON.parse(filters) : filters
        Object.entries(filterObj).forEach(([key, value]) => {
          query = query.eq(key, value)
        })
      }

      const { data, error } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, results: data, count: data.length }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
}

export const emailTool: AgentTool = {
  name: "send_email",
  description: "Send an email to a user. Use this to send notifications, reports, or other communications.",
  parameters: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description: "Recipient email address",
      },
      subject: {
        type: "string",
        description: "Email subject",
      },
      body: {
        type: "string",
        description: "Email body (HTML supported)",
      },
    },
    required: ["to", "subject", "body"],
  },
  handler: async ({ to, subject, body }) => {
    try {
      const { Resend } = await import("resend")
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      if (!process.env.RESEND_API_KEY) {
        return { success: false, error: "Resend API key not configured" }
      }

      const result = await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@example.com",
        to,
        subject,
        html: body,
      })
      
      return { success: true, messageId: result.data?.id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
}

export const webSearchTool: AgentTool = {
  name: "web_search",
  description: "Search the web for current information. Use this when you need up-to-date information that might not be in the database.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results (default: 5)",
      },
    },
    required: ["query"],
  },
  handler: async ({ query: _query, maxResults: _maxResults = 5 }) => {
    // Placeholder implementation
    try {
      return {
        success: true,
        message: "Web search not configured. Please set up a search API (Tavily, Serper, etc.)",
        results: [],
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
}

// Export all tools
export const defaultTools = [databaseTool, emailTool, webSearchTool]
