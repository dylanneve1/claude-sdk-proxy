/**
 * OpenAI-compatible request/response types for the proxy server
 */

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  name?: string
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
}

export interface OpenAIToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface OpenAIChatRequest {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  tools?: OpenAITool[]
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } }
}

export interface OpenAITool {
  type: "function"
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

export interface OpenAIChatResponse {
  id: string
  object: "chat.completion"
  created: number
  model: string
  choices: Array<{
    index: number
    message: OpenAIMessage
    finish_reason: "stop" | "tool_calls" | "length" | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenAIStreamChunk {
  id: string
  object: "chat.completion.chunk"
  created: number
  model: string
  choices: Array<{
    index: number
    delta: Partial<OpenAIMessage>
    finish_reason: "stop" | "tool_calls" | "length" | null
  }>
}

export interface ProxyConfig {
  port: number
  host: string
  debug: boolean
}

export const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  port: 3456,
  host: "127.0.0.1",
  debug: process.env.CLAUDE_PROXY_DEBUG === "1"
}
