import { describe, it, expect } from "bun:test"
import { createClaudeMaxProvider } from "../../src/claudeProvider"

describe("createClaudeMaxProvider", () => {
  it("should create a provider with languageModel method", () => {
    const provider = createClaudeMaxProvider()
    expect(provider.languageModel).toBeDefined()
    expect(typeof provider.languageModel).toBe("function")
  })
  
  it("should create a language model with required properties", () => {
    const provider = createClaudeMaxProvider()
    const model = provider.languageModel("claude-max-opus")
    
    expect(model.specificationVersion).toBe("v2")
    expect(model.provider).toBe("claude-max")
    expect(model.modelId).toBe("claude-max-opus")
  })
  
  it("should have doStream and doGenerate methods", () => {
    const provider = createClaudeMaxProvider()
    const model = provider.languageModel("claude-max-sonnet")
    
    expect(typeof model.doStream).toBe("function")
    expect(typeof model.doGenerate).toBe("function")
  })
  
  it("should throw for unsupported embedding model", () => {
    const provider = createClaudeMaxProvider()
    expect(() => provider.textEmbeddingModel("test")).toThrow()
  })
  
  it("should throw for unsupported image model", () => {
    const provider = createClaudeMaxProvider()
    expect(() => provider.imageModel("test")).toThrow()
  })
})
