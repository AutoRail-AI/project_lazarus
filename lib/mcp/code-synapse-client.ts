/**
 * MCP HTTP client for Code-Synapse.
 * Code-Synapse exposes an MCP server at {baseUrl}/mcp that accepts JSON-RPC.
 */

interface McpResponse<T = unknown> {
  jsonrpc: string
  id: number
  result?: { content: Array<{ type: string; text: string }> }
  error?: { code: number; message: string }
}

export class CodeSynapseClient {
  private requestId = 0

  constructor(private baseUrl: string) {}

  /**
   * Call an MCP tool via JSON-RPC over HTTP POST.
   */
  async callTool<T = unknown>(
    toolName: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    this.requestId++

    const body = {
      jsonrpc: "2.0",
      id: this.requestId,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: params ?? {},
      },
    }

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(
        `Code-Synapse MCP call failed: ${response.status} ${response.statusText}`
      )
    }

    const data = (await response.json()) as McpResponse<T>

    if (data.error) {
      throw new Error(`MCP error [${data.error.code}]: ${data.error.message}`)
    }

    // MCP tools return content as text array; parse the first text element as JSON
    const content = data.result?.content
    if (!content || content.length === 0) {
      return {} as T
    }

    const textContent = content.find((c) => c.type === "text")
    if (!textContent) return {} as T

    try {
      return JSON.parse(textContent.text) as T
    } catch {
      return textContent.text as unknown as T
    }
  }

  async getFeatureMap(includeEntities = true) {
    return this.callTool("get_feature_map", { includeEntities })
  }

  async getSliceDependencies() {
    return this.callTool("get_slice_dependencies")
  }

  async getMigrationContext(featureContext: string) {
    return this.callTool("get_migration_context", { featureContext })
  }

  async getEntitySource(entityId: string) {
    return this.callTool("get_entity_source", { entityId })
  }

  async getProjectStats() {
    return this.callTool("get_project_stats")
  }
}

export function createCodeSynapseClient(baseUrl: string): CodeSynapseClient {
  return new CodeSynapseClient(baseUrl)
}
