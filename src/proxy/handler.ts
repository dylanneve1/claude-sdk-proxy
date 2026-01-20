import { query } from "@anthropic-ai/claude-agent-sdk"
import type { OpenAIChatRequest, OpenAIMessage, OpenAIStreamChunk } from "./types"
import { claudeLog } from "../logger"

function generateId(): string {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function mapModelToClaudeModel(model: string): "sonnet" | "opus" | "haiku" {
  const modelMap: Record<string, "sonnet" | "opus" | "haiku"> = {
    "claude-max-opus": "opus",
    "claude-max-sonnet": "sonnet",
    "claude-max-opus-thinking": "opus",
    "claude-opus-4-5": "opus",
    "claude-sonnet-4-5": "sonnet",
    "claude-sonnet-4": "sonnet",
    "claude-opus-4": "opus",
    "claude-haiku": "haiku"
  }
  return modelMap[model] || "sonnet"
}

function convertMessagesToPrompt(messages: OpenAIMessage[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === "assistant" ? "Assistant" : msg.role === "system" ? "System" : "Human"
      return `${role}: ${msg.content || ""}`
    })
    .join("\n\n")
}

function createStreamChunk(
  id: string,
  model: string,
  content: string,
  finishReason: "stop" | null = null
): OpenAIStreamChunk {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: content ? { content } : {},
        finish_reason: finishReason
      }
    ]
  }
}

function formatSSE(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function handleChatCompletion(
  request: OpenAIChatRequest
): Promise<ReadableStream<Uint8Array>> {
  const id = generateId()
  const model = mapModelToClaudeModel(request.model)
  const prompt = convertMessagesToPrompt(request.messages)

  claudeLog("proxy.request", { model, messageCount: request.messages.length })

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const roleChunk = createStreamChunk(id, model, "")
        const firstChoice = roleChunk.choices[0]
        if (firstChoice) {
          ;(firstChoice.delta as Record<string, string>).role = "assistant"
        }
        controller.enqueue(encoder.encode(formatSSE(roleChunk)))

        const response = query({
          prompt,
          options: {
            maxTurns: 1,
            model
          }
        })

        for await (const message of response) {
          if (message.type === "assistant") {
            for (const block of message.message.content) {
              if (block.type === "text") {
                const chunk = createStreamChunk(id, model, block.text)
                controller.enqueue(encoder.encode(formatSSE(chunk)))
              }
            }
          }
        }

        const doneChunk = createStreamChunk(id, model, "", "stop")
        controller.enqueue(encoder.encode(formatSSE(doneChunk)))
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()

        claudeLog("proxy.complete", { id })
      } catch (error) {
        claudeLog("proxy.error", { error: error instanceof Error ? error.message : String(error) })
        
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        const errorChunk = createStreamChunk(id, model, `\n\n[Error: ${errorMessage}]`, "stop")
        controller.enqueue(encoder.encode(formatSSE(errorChunk)))
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      }
    }
  })
}

export async function handleChatCompletionNonStreaming(
  request: OpenAIChatRequest
): Promise<{
  id: string
  object: "chat.completion"
  created: number
  model: string
  choices: Array<{
    index: number
    message: { role: "assistant"; content: string }
    finish_reason: "stop"
  }>
}> {
  const id = generateId()
  const model = mapModelToClaudeModel(request.model)
  const prompt = convertMessagesToPrompt(request.messages)

  claudeLog("proxy.request.nonstream", { model })

  let fullContent = ""

  const response = query({
    prompt,
    options: {
      maxTurns: 1,
      model
    }
  })

  for await (const message of response) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          fullContent += block.text
        }
      }
    }
  }

  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: fullContent },
        finish_reason: "stop"
      }
    ]
  }
}
