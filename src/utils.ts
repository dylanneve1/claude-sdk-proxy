import type { LanguageModelV2CallOptions } from "@ai-sdk/provider"

/**
 * Extract text content from various message structures
 */
export function extractTextFromParts(parts: unknown[]): string {
  const textSegments: string[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const p = part as Record<string, unknown>
    if (p.type === "text" && typeof p.text === "string") {
      const trimmed = (p.text as string).trim()
      if (trimmed) textSegments.push(trimmed)
    } else if (p.type === "tool-result" && typeof p.output === "object" && p.output !== null) {
      const serialized = JSON.stringify(p.output)
      if (serialized) textSegments.push(serialized)
    }
  }
  return textSegments.join("\n").trim()
}

export function extractTextFromMessage(message: { content: string | unknown[] }): string {
  if (typeof message.content === "string") {
    return message.content.trim()
  }
  if (Array.isArray(message.content)) {
    return extractTextFromParts(message.content)
  }
  return ""
}

/**
 * Build conversation payload from AI SDK prompt format
 */
export function buildConversationPayload(messages: LanguageModelV2CallOptions["prompt"]) {
  const systemSegments: string[] = []
  const userSegments: string[] = []
  const assistantSegments: string[] = []

  const iterable = Array.isArray(messages) ? messages : []

  for (const raw of iterable) {
    const message = raw as {
      role: string
      content: string | { type: string; text?: string }[]
    }
    
    if (message.role === "system") {
      if (typeof message.content === "string") {
        const trimmed = message.content.trim()
        if (trimmed) systemSegments.push(trimmed)
      } else if (Array.isArray(message.content)) {
        const text = extractTextFromParts(message.content)
        if (text) systemSegments.push(text)
      }
      continue
    }

    const text = extractTextFromMessage(message as { content: string | unknown[] })
    if (!text) continue

    if (message.role === "assistant") {
      assistantSegments.push(text)
    } else if (message.role === "user") {
      userSegments.push(text)
    }
  }

  return {
    systemPrompt: systemSegments.length ? systemSegments.join("\n\n").trim() : undefined,
    userPrompt: userSegments.join("\n\n").trim(),
    assistantContext: assistantSegments.join("\n\n").trim()
  }
}

/**
 * Map model ID to Claude SDK model name
 */
export function mapModelId(modelId: string): string {
  if (modelId.includes("opus")) return "opus"
  if (modelId.includes("sonnet")) return "sonnet"
  if (modelId.includes("haiku")) return "haiku"
  return "sonnet" // default
}

/**
 * Check if thinking mode is enabled based on model ID
 */
export function isThinkingModel(modelId: string): boolean {
  return modelId.includes("thinking")
}
