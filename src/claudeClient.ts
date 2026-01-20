import { query } from "@anthropic-ai/claude-agent-sdk"
import { opencodeMcpServer } from "./mcpTools"
import { claudeLog } from "./logger"
import { 
  BLOCKED_BUILTIN_TOOLS, 
  ALLOWED_MCP_TOOLS, 
  MCP_SERVER_NAME,
  type ClaudeProviderOptions,
  type SDKMessage 
} from "./types"

export interface QueryOptions {
  prompt: string
  systemPrompt?: string
  model?: string
  maxTurns?: number
  permissionMode?: ClaudeProviderOptions["permissionMode"]
  cwd?: string
  abortSignal?: AbortSignal
}

/**
 * Create an async generator for streaming input mode (required for MCP servers)
 */
async function* createMessageGenerator(options: QueryOptions) {
  let fullPrompt = options.prompt
  if (options.systemPrompt) {
    fullPrompt = `${options.systemPrompt}\n\n${fullPrompt}`
  }
  
  yield {
    type: "user" as const,
    parent_tool_use_id: null,
    session_id: "",
    message: {
      role: "user" as const,
      content: fullPrompt
    }
  }
}

/**
 * Query Claude using the Agent SDK with our MCP tools
 */
export async function* queryClaudeSDK(options: QueryOptions): AsyncGenerator<SDKMessage> {
  claudeLog("query.start", { 
    promptLength: options.prompt.length,
    model: options.model,
    maxTurns: options.maxTurns
  })
  
  const queryResult = query({
    prompt: createMessageGenerator(options),
    options: {
      cwd: options.cwd || process.cwd(),
      model: options.model,
      maxTurns: options.maxTurns || 100,
      permissionMode: options.permissionMode || "default",
      
      // Block Claude's built-in tools
      disallowedTools: [...BLOCKED_BUILTIN_TOOLS],
      
      // Enable only our MCP tools
      allowedTools: [...ALLOWED_MCP_TOOLS],
      
      // Configure our in-process MCP server
      mcpServers: {
        [MCP_SERVER_NAME]: opencodeMcpServer
      }
    }
  })
  
  try {
    for await (const message of queryResult) {
      claudeLog("query.message", { type: message.type })
      yield message as SDKMessage
    }
  } catch (error) {
    claudeLog("query.error", { 
      error: error instanceof Error ? error.message : String(error) 
    })
    throw error
  } finally {
    claudeLog("query.complete", {})
  }
}

/**
 * Simple interface for non-streaming queries (convenience function)
 */
export async function queryClaudeSimple(options: QueryOptions): Promise<{
  result: string
  usage: { inputTokens: number; outputTokens: number }
}> {
  let result = ""
  let usage = { inputTokens: 0, outputTokens: 0 }
  
  for await (const message of queryClaudeSDK(options)) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          result += block.text
        }
      }
    }
    if (message.type === "result" && message.subtype === "success") {
      result = message.result || result
      usage = {
        inputTokens: message.usage?.input_tokens || 0,
        outputTokens: message.usage?.output_tokens || 0
      }
    }
  }
  
  return { result, usage }
}
