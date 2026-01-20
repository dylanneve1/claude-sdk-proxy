import type { LanguageModelV2StreamPart, LanguageModelV2FinishReason } from "@ai-sdk/provider"
import type { SDKMessage, SDKAssistantMessage, SDKResultMessage } from "./types"
import { claudeLog } from "./logger"

let textBlockId = 0
const generateTextId = () => `text-${++textBlockId}`

export function* transformMessage(message: SDKMessage): Generator<LanguageModelV2StreamPart> {
  claudeLog("transform.message", { type: message.type })
  
  switch (message.type) {
    case "system":
      claudeLog("transform.system_init", { 
        tools: (message as { tools?: string[] }).tools?.length || 0,
        model: (message as { model?: string }).model 
      })
      break
      
    case "assistant":
      yield* transformAssistantMessage(message as SDKAssistantMessage)
      break
      
    case "result":
      yield* transformResultMessage(message as SDKResultMessage)
      break
      
    default:
      claudeLog("transform.unknown_type", { type: (message as { type: string }).type })
  }
}

function* transformAssistantMessage(message: SDKAssistantMessage): Generator<LanguageModelV2StreamPart> {
  const content = message.message?.content
  if (!Array.isArray(content)) return
  
  for (const block of content) {
    if (block.type === "text" && block.text) {
      yield {
        type: "text-delta",
        id: generateTextId(),
        delta: block.text
      }
    } else if (block.type === "tool_use") {
      yield {
        type: "tool-call",
        toolCallId: block.id,
        toolName: block.name,
        input: JSON.stringify(block.input)
      }
    }
  }
}

function* transformResultMessage(message: SDKResultMessage): Generator<LanguageModelV2StreamPart> {
  let finishReason: LanguageModelV2FinishReason = "stop"
  
  if (message.subtype === "success") {
    finishReason = "stop"
    
    if (message.result) {
      yield {
        type: "text-delta",
        id: generateTextId(),
        delta: message.result
      }
    }
  } else {
    finishReason = "error"
    
    if (message.errors && message.errors.length > 0) {
      yield {
        type: "error",
        error: new Error(message.errors.join("; "))
      }
    }
  }
  
  yield {
    type: "finish",
    finishReason,
    usage: {
      inputTokens: message.usage?.input_tokens || 0,
      outputTokens: message.usage?.output_tokens || 0,
      totalTokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
    }
  }
}

export function mapFinishReason(subtype: string): LanguageModelV2FinishReason {
  switch (subtype) {
    case "success":
      return "stop"
    case "error_max_turns":
      return "length"
    case "error_during_execution":
    case "error_max_budget_usd":
    case "error_max_structured_output_retries":
      return "error"
    default:
      return "unknown"
  }
}
