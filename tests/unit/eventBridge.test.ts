import { describe, it, expect } from "bun:test"
import { transformMessage, mapFinishReason } from "../../src/eventBridge"
import type { SDKAssistantMessage, SDKResultMessage, SDKSystemMessage } from "../../src/types"

describe("eventBridge", () => {
  describe("transformMessage", () => {
    it("should transform assistant text message", () => {
      const message: SDKAssistantMessage = {
        type: "assistant",
        uuid: "123",
        session_id: "sess",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello" }]
        }
      }
      
      const parts = [...transformMessage(message)]
      expect(parts).toHaveLength(1)
      expect(parts[0]?.type).toBe("text-delta")
      expect((parts[0] as { delta: string }).delta).toBe("Hello")
    })
    
    it("should transform assistant tool use message", () => {
      const message: SDKAssistantMessage = {
        type: "assistant",
        uuid: "123",
        session_id: "sess",
        message: {
          role: "assistant",
          content: [{
            type: "tool_use",
            id: "tool-1",
            name: "read_file",
            input: { path: "/test.txt" }
          }]
        }
      }
      
      const parts = [...transformMessage(message)]
      expect(parts).toHaveLength(1)
      expect(parts[0]?.type).toBe("tool-call")
      const toolCall = parts[0] as { 
        type: string
        toolCallId: string
        toolName: string
        input: string
      }
      expect(toolCall.toolCallId).toBe("tool-1")
      expect(toolCall.toolName).toBe("read_file")
      expect(toolCall.input).toBe('{"path":"/test.txt"}')
    })
    
    it("should transform mixed content message", () => {
      const message: SDKAssistantMessage = {
        type: "assistant",
        uuid: "123",
        session_id: "sess",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Let me read that" },
            {
              type: "tool_use",
              id: "tool-1",
              name: "read_file",
              input: { path: "/test.txt" }
            }
          ]
        }
      }
      
      const parts = [...transformMessage(message)]
      expect(parts).toHaveLength(2)
      expect(parts[0]?.type).toBe("text-delta")
      expect(parts[1]?.type).toBe("tool-call")
    })
    
    it("should handle empty content array", () => {
      const message: SDKAssistantMessage = {
        type: "assistant",
        uuid: "123",
        session_id: "sess",
        message: {
          role: "assistant",
          content: []
        }
      }
      
      const parts = [...transformMessage(message)]
      expect(parts).toHaveLength(0)
    })
    
    it("should transform result success with text", () => {
      const message: SDKResultMessage = {
        type: "result",
        subtype: "success",
        uuid: "123",
        session_id: "sess",
        duration_ms: 100,
        is_error: false,
        num_turns: 1,
        result: "Done",
        total_cost_usd: 0.01,
        usage: { input_tokens: 10, output_tokens: 20 }
      }
      
      const parts = [...transformMessage(message)]
      expect(parts.length).toBeGreaterThanOrEqual(2)
      
      const textPart = parts.find(p => p.type === "text-delta")
      expect(textPart).toBeDefined()
      expect((textPart as { delta: string }).delta).toBe("Done")
      
      const finishPart = parts.find(p => p.type === "finish")
      expect(finishPart).toBeDefined()
      const finish = finishPart as {
        type: string
        finishReason: string
        usage: { inputTokens: number; outputTokens: number; totalTokens: number }
      }
      expect(finish.finishReason).toBe("stop")
      expect(finish.usage.inputTokens).toBe(10)
      expect(finish.usage.outputTokens).toBe(20)
      expect(finish.usage.totalTokens).toBe(30)
    })
    
    it("should transform result success without text", () => {
      const message: SDKResultMessage = {
        type: "result",
        subtype: "success",
        uuid: "123",
        session_id: "sess",
        duration_ms: 100,
        is_error: false,
        num_turns: 1,
        total_cost_usd: 0.01,
        usage: { input_tokens: 10, output_tokens: 20 }
      }
      
      const parts = [...transformMessage(message)]
      expect(parts).toHaveLength(1)
      expect(parts[0]?.type).toBe("finish")
    })
    
    it("should transform result error", () => {
      const message: SDKResultMessage = {
        type: "result",
        subtype: "error_during_execution",
        uuid: "123",
        session_id: "sess",
        duration_ms: 100,
        is_error: true,
        num_turns: 1,
        errors: ["Something went wrong", "Another error"],
        total_cost_usd: 0.01,
        usage: { input_tokens: 10, output_tokens: 5 }
      }
      
      const parts = [...transformMessage(message)]
      expect(parts.length).toBeGreaterThanOrEqual(2)
      
      const errorPart = parts.find(p => p.type === "error")
      expect(errorPart).toBeDefined()
      const error = errorPart as { type: string; error: Error }
      expect(error.error.message).toContain("Something went wrong")
      expect(error.error.message).toContain("Another error")
      
      const finishPart = parts.find(p => p.type === "finish")
      expect(finishPart).toBeDefined()
      const finish = finishPart as { finishReason: string }
      expect(finish.finishReason).toBe("error")
    })
    
    it("should handle result error without errors array", () => {
      const message: SDKResultMessage = {
        type: "result",
        subtype: "error_during_execution",
        uuid: "123",
        session_id: "sess",
        duration_ms: 100,
        is_error: true,
        num_turns: 1,
        total_cost_usd: 0.01,
        usage: { input_tokens: 10, output_tokens: 5 }
      }
      
      const parts = [...transformMessage(message)]
      expect(parts).toHaveLength(1)
      expect(parts[0]?.type).toBe("finish")
    })
    
    it("should handle system message", () => {
      const message: SDKSystemMessage = {
        type: "system",
        subtype: "init",
        uuid: "123",
        session_id: "sess",
        tools: ["read", "write"],
        mcp_servers: [{ name: "opencode", status: "connected" }],
        model: "opus",
        permissionMode: "default"
      }
      
      const parts = [...transformMessage(message)]
      expect(parts).toHaveLength(0)
    })
    
    it("should handle unknown message type", () => {
      const message = {
        type: "unknown",
        uuid: "123",
        session_id: "sess"
      } as unknown as SDKAssistantMessage
      
      const parts = [...transformMessage(message)]
      expect(parts).toHaveLength(0)
    })
  })
  
  describe("mapFinishReason", () => {
    it("should map success to stop", () => {
      expect(mapFinishReason("success")).toBe("stop")
    })
    
    it("should map error_max_turns to length", () => {
      expect(mapFinishReason("error_max_turns")).toBe("length")
    })
    
    it("should map error_during_execution to error", () => {
      expect(mapFinishReason("error_during_execution")).toBe("error")
    })
    
    it("should map error_max_budget_usd to error", () => {
      expect(mapFinishReason("error_max_budget_usd")).toBe("error")
    })
    
    it("should map error_max_structured_output_retries to error", () => {
      expect(mapFinishReason("error_max_structured_output_retries")).toBe("error")
    })
    
    it("should map unknown to unknown", () => {
      expect(mapFinishReason("some_other_type")).toBe("unknown")
    })
  })
})
