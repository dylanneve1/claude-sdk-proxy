import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  SharedV2Headers,
  ProviderV2,
} from "@ai-sdk/provider"
import { queryClaudeSDK, type QueryOptions } from "./claudeClient"
import { transformMessage } from "./eventBridge"
import { buildConversationPayload, mapModelId, isThinkingModel } from "./utils"
import { claudeLog } from "./logger"
import type { ClaudeProviderOptions, SDKMessage } from "./types"

class ClaudeLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const
  readonly provider = "claude-max"
  readonly supportedUrls: Record<string, RegExp[]> = { "*/*": [] }

  constructor(public readonly modelId: string) {}

  get modelIdForLogging() {
    return this.modelId
  }

  get modelIdLabel() {
    return this.modelId
  }

  get modelIdValue() {
    return this.modelId
  }

  async doGenerate(options: LanguageModelV2CallOptions) {
    const { stream } = await this.doStream(options)
    const reader = stream.getReader()
    let text = ""
    let finishReason: LanguageModelV2FinishReason = "stop"
    let usage: LanguageModelV2Usage | undefined

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      switch (value.type) {
        case "text-delta":
          text += value.delta
          break
        case "finish":
          finishReason = value.finishReason
          usage = value.usage
          break
        case "error":
          throw value.error instanceof Error ? value.error : new Error(String(value.error))
      }
    }

    const content: LanguageModelV2Content[] = text
      ? [{ type: "text", text }]
      : []

    return {
      content,
      finishReason,
      usage: usage ?? {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      },
      warnings: [],
    }
  }

  async doStream(
    options: LanguageModelV2CallOptions,
  ): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>
    request?: { body?: unknown }
    response?: { headers?: SharedV2Headers }
  }> {
    const providerOptions = this.extractProviderOptions(options)
    const { systemPrompt, userPrompt, assistantContext } = buildConversationPayload(options.prompt)
    
    let prompt = userPrompt || "Please respond to the request."
    if (assistantContext) {
      prompt = `${prompt}\n\nAssistant context:\n${assistantContext}`
    }

    const sdkModel = mapModelId(this.modelId)
    const useThinking = isThinkingModel(this.modelId) || providerOptions.enableThinking

    claudeLog("doStream.start", { 
      modelId: this.modelId, 
      sdkModel, 
      useThinking,
      promptLength: prompt.length 
    })

    const queryOptions: QueryOptions = {
      prompt,
      systemPrompt,
      model: sdkModel,
      maxTurns: providerOptions.maxTurns ?? 100,
      permissionMode: providerOptions.permissionMode ?? "default",
      cwd: providerOptions.cwd ?? process.cwd(),
      abortSignal: options.abortSignal,
    }

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start: async (controller) => {
        try {
          for await (const message of queryClaudeSDK(queryOptions)) {
            for (const part of transformMessage(message)) {
              controller.enqueue(part)
            }
          }
          controller.close()
        } catch (error) {
          claudeLog("doStream.error", { 
            error: error instanceof Error ? error.message : String(error) 
          })
          controller.error(error)
        }
      },
      cancel: async () => {
        claudeLog("doStream.cancelled", {})
      },
    })

    return { stream }
  }

  private extractProviderOptions(options: LanguageModelV2CallOptions): ClaudeProviderOptions {
    const providerSpecific = (
      (options.providerOptions ?? {}) as Record<string, ClaudeProviderOptions | undefined>
    )[this.provider] ?? {}
    return providerSpecific
  }
}

export function createClaudeMaxProvider(): ProviderV2 {
  return {
    languageModel: (modelId: string) => new ClaudeLanguageModel(modelId),
    textEmbeddingModel: (modelId: string) => {
      throw new Error(`Claude Max provider does not support text embeddings (requested model: ${modelId})`)
    },
    imageModel: (modelId: string) => {
      throw new Error(`Claude Max provider does not support image models (requested model: ${modelId})`)
    },
  }
}
