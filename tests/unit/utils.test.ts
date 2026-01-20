import { describe, it, expect } from "bun:test"
import { 
  extractTextFromParts, 
  extractTextFromMessage, 
  mapModelId, 
  isThinkingModel,
  buildConversationPayload 
} from "../../src/utils"

describe("utils", () => {
  describe("extractTextFromParts", () => {
    it("should extract text from text parts", () => {
      const parts = [{ type: "text", text: "hello" }]
      expect(extractTextFromParts(parts)).toBe("hello")
    })
    
    it("should handle empty array", () => {
      expect(extractTextFromParts([])).toBe("")
    })
    
    it("should handle multiple text parts", () => {
      const parts = [
        { type: "text", text: "hello" },
        { type: "text", text: "world" }
      ]
      expect(extractTextFromParts(parts)).toBe("hello\nworld")
    })
    
    it("should skip empty text", () => {
      const parts = [
        { type: "text", text: "hello" },
        { type: "text", text: "  " },
        { type: "text", text: "world" }
      ]
      expect(extractTextFromParts(parts)).toBe("hello\nworld")
    })
    
    it("should handle tool-result parts", () => {
      const parts = [
        { type: "tool-result", output: { result: "success" } }
      ]
      expect(extractTextFromParts(parts)).toBe('{"result":"success"}')
    })
    
    it("should handle mixed parts", () => {
      const parts = [
        { type: "text", text: "hello" },
        { type: "tool-result", output: { data: 42 } }
      ]
      const result = extractTextFromParts(parts)
      expect(result).toContain("hello")
      expect(result).toContain('"data":42')
    })
    
    it("should skip invalid parts", () => {
      const parts = [
        null,
        undefined,
        { type: "unknown" },
        { type: "text", text: "valid" }
      ]
      expect(extractTextFromParts(parts)).toBe("valid")
    })
  })
  
  describe("extractTextFromMessage", () => {
    it("should extract string content", () => {
      const message = { content: "hello world" }
      expect(extractTextFromMessage(message)).toBe("hello world")
    })
    
    it("should extract array content", () => {
      const message = { 
        content: [{ type: "text", text: "hello" }] 
      }
      expect(extractTextFromMessage(message)).toBe("hello")
    })
    
    it("should handle empty string", () => {
      const message = { content: "" }
      expect(extractTextFromMessage(message)).toBe("")
    })
    
    it("should trim whitespace", () => {
      const message = { content: "  hello  " }
      expect(extractTextFromMessage(message)).toBe("hello")
    })
  })
  
  describe("buildConversationPayload", () => {
    it("should extract system prompt", () => {
      const messages = [
        { role: "system", content: "You are helpful" }
      ] as unknown[]
      const result = buildConversationPayload(messages as never)
      expect(result.systemPrompt).toBe("You are helpful")
    })
    
    it("should extract user prompt", () => {
      const messages = [
        { role: "user", content: "Hello" }
      ] as unknown[]
      const result = buildConversationPayload(messages as never)
      expect(result.userPrompt).toBe("Hello")
    })
    
    it("should extract assistant context", () => {
      const messages = [
        { role: "assistant", content: "Hi there" }
      ] as unknown[]
      const result = buildConversationPayload(messages as never)
      expect(result.assistantContext).toBe("Hi there")
    })
    
    it("should handle multiple messages of same role", () => {
      const messages = [
        { role: "user", content: "First" },
        { role: "user", content: "Second" }
      ] as unknown[]
      const result = buildConversationPayload(messages as never)
      expect(result.userPrompt).toBe("First\n\nSecond")
    })
    
    it("should handle array content", () => {
      const messages = [
        { 
          role: "user", 
          content: [{ type: "text", text: "Hello" }] 
        }
      ] as unknown[]
      const result = buildConversationPayload(messages as never)
      expect(result.userPrompt).toBe("Hello")
    })
    
    it("should skip empty messages", () => {
      const messages = [
        { role: "user", content: "" },
        { role: "user", content: "Valid" }
      ] as unknown[]
      const result = buildConversationPayload(messages as never)
      expect(result.userPrompt).toBe("Valid")
    })
    
    it("should handle empty array", () => {
      const result = buildConversationPayload([])
      expect(result.systemPrompt).toBeUndefined()
      expect(result.userPrompt).toBe("")
      expect(result.assistantContext).toBe("")
    })
    
    it("should handle multiple system messages", () => {
      const messages = [
        { role: "system", content: "First" },
        { role: "system", content: "Second" }
      ] as unknown[]
      const result = buildConversationPayload(messages as never)
      expect(result.systemPrompt).toBe("First\n\nSecond")
    })
  })
  
  describe("mapModelId", () => {
    it("should map opus model", () => {
      expect(mapModelId("claude-max-opus")).toBe("opus")
    })
    
    it("should map sonnet model", () => {
      expect(mapModelId("claude-max-sonnet")).toBe("sonnet")
    })
    
    it("should map haiku model", () => {
      expect(mapModelId("claude-max-haiku")).toBe("haiku")
    })
    
    it("should default to sonnet", () => {
      expect(mapModelId("unknown")).toBe("sonnet")
    })
    
    it("should handle partial matches", () => {
      expect(mapModelId("some-opus-variant")).toBe("opus")
      expect(mapModelId("sonnet-3.5")).toBe("sonnet")
      expect(mapModelId("haiku-fast")).toBe("haiku")
    })
  })
  
  describe("isThinkingModel", () => {
    it("should detect thinking model", () => {
      expect(isThinkingModel("claude-max-opus-thinking")).toBe(true)
    })
    
    it("should return false for non-thinking model", () => {
      expect(isThinkingModel("claude-max-opus")).toBe(false)
    })
    
    it("should handle various thinking patterns", () => {
      expect(isThinkingModel("thinking-model")).toBe(true)
      expect(isThinkingModel("model-thinking")).toBe(true)
      expect(isThinkingModel("thinking")).toBe(true)
    })
    
    it("should be case sensitive", () => {
      expect(isThinkingModel("THINKING")).toBe(false)
      expect(isThinkingModel("Thinking")).toBe(false)
    })
  })
})
