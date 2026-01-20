import { describe, it, expect } from "bun:test"
import { 
  BLOCKED_BUILTIN_TOOLS, 
  ALLOWED_MCP_TOOLS, 
  MCP_SERVER_NAME 
} from "../../src/types"

describe("types", () => {
  describe("BLOCKED_BUILTIN_TOOLS", () => {
    it("should contain expected tools", () => {
      expect(BLOCKED_BUILTIN_TOOLS).toContain("Read")
      expect(BLOCKED_BUILTIN_TOOLS).toContain("Write")
      expect(BLOCKED_BUILTIN_TOOLS).toContain("Bash")
      expect(BLOCKED_BUILTIN_TOOLS).toContain("Edit")
      expect(BLOCKED_BUILTIN_TOOLS).toContain("Glob")
      expect(BLOCKED_BUILTIN_TOOLS).toContain("Grep")
    })
    
    it("should be a readonly array", () => {
      expect(Array.isArray(BLOCKED_BUILTIN_TOOLS)).toBe(true)
    })
    
    it("should have correct length", () => {
      expect(BLOCKED_BUILTIN_TOOLS.length).toBe(11)
    })
  })
  
  describe("MCP_SERVER_NAME", () => {
    it("should be 'opencode'", () => {
      expect(MCP_SERVER_NAME).toBe("opencode")
    })
  })
  
  describe("ALLOWED_MCP_TOOLS", () => {
    it("should use correct MCP naming pattern", () => {
      for (const tool of ALLOWED_MCP_TOOLS) {
        expect(tool.startsWith(`mcp__${MCP_SERVER_NAME}__`)).toBe(true)
      }
    })
    
    it("should contain expected tools", () => {
      expect(ALLOWED_MCP_TOOLS).toContain("mcp__opencode__read")
      expect(ALLOWED_MCP_TOOLS).toContain("mcp__opencode__write")
      expect(ALLOWED_MCP_TOOLS).toContain("mcp__opencode__edit")
      expect(ALLOWED_MCP_TOOLS).toContain("mcp__opencode__bash")
      expect(ALLOWED_MCP_TOOLS).toContain("mcp__opencode__glob")
      expect(ALLOWED_MCP_TOOLS).toContain("mcp__opencode__grep")
    })
    
    it("should have correct length", () => {
      expect(ALLOWED_MCP_TOOLS.length).toBe(6)
    })
  })
})
