// JSON-RPC types
type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

// Provider configuration
export type ClaudeProviderOptions = {
  model?: string  // "opus" | "sonnet" | "haiku"
  maxTurns?: number  // default 100
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan"
  enableThinking?: boolean
  thinkingBudget?: number
  cwd?: string
  clientInfo?: {
    name?: string
    version?: string
  }
}

// SDK Message types
export type SDKMessageType = 
  | "system"
  | "assistant" 
  | "user"
  | "result"

export type SDKSystemMessage = {
  type: "system"
  subtype: "init"
  uuid: string
  session_id: string
  tools: string[]
  mcp_servers: { name: string; status: string }[]
  model: string
  permissionMode: string
}

export type SDKAssistantMessage = {
  type: "assistant"
  uuid: string
  session_id: string
  message: {
    role: "assistant"
    content: Array<{
      type: "text"
      text: string
    } | {
      type: "tool_use"
      id: string
      name: string
      input: Record<string, unknown>
    }>
  }
}

export type SDKResultMessage = {
  type: "result"
  subtype: "success" | "error_max_turns" | "error_during_execution"
  uuid: string
  session_id: string
  duration_ms: number
  is_error: boolean
  num_turns: number
  result?: string
  errors?: string[]
  total_cost_usd: number
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export type SDKMessage = SDKSystemMessage | SDKAssistantMessage | SDKResultMessage

// Constants
export const BLOCKED_BUILTIN_TOOLS = [
  "Read", "Write", "Edit", "MultiEdit",
  "Bash", "Glob", "Grep", "NotebookEdit",
  "WebFetch", "WebSearch", "TodoWrite"
] as const

export const MCP_SERVER_NAME = "opencode"

export const ALLOWED_MCP_TOOLS = [
  `mcp__${MCP_SERVER_NAME}__read`,
  `mcp__${MCP_SERVER_NAME}__write`,
  `mcp__${MCP_SERVER_NAME}__edit`,
  `mcp__${MCP_SERVER_NAME}__bash`,
  `mcp__${MCP_SERVER_NAME}__glob`,
  `mcp__${MCP_SERVER_NAME}__grep`
] as const
