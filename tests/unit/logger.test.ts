import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test"
import { claudeLog } from "../../src/logger"

describe("logger", () => {
  let consoleSpy: ReturnType<typeof spyOn>
  
  beforeEach(() => {
    consoleSpy = spyOn(console, "debug").mockImplementation(() => {})
  })
  
  afterEach(() => {
    consoleSpy.mockRestore()
    delete process.env["OPENCODE_CLAUDE_PROVIDER_DEBUG"]
  })
  
  it("should not log when debug is disabled", () => {
    claudeLog("test message", {})
    expect(consoleSpy).not.toHaveBeenCalled()
  })
  
  it("should log when debug is enabled", () => {
    process.env["OPENCODE_CLAUDE_PROVIDER_DEBUG"] = "1"
    claudeLog("test message", { key: "value" })
    expect(consoleSpy).toHaveBeenCalled()
  })
  
  it("should include message prefix", () => {
    process.env["OPENCODE_CLAUDE_PROVIDER_DEBUG"] = "1"
    claudeLog("test", {})
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[opencode-claude-code-provider]")
    )
  })
  
  it("should include extra data when provided", () => {
    process.env["OPENCODE_CLAUDE_PROVIDER_DEBUG"] = "1"
    claudeLog("test", { foo: "bar" })
    const call = consoleSpy.mock.calls[0]?.[0] as string
    expect(call).toContain("test")
    expect(call).toContain(JSON.stringify({ foo: "bar" }))
  })
  
  it("should not include extra data when empty", () => {
    process.env["OPENCODE_CLAUDE_PROVIDER_DEBUG"] = "1"
    claudeLog("test", {})
    const call = consoleSpy.mock.calls[0]?.[0] as string
    expect(call).not.toContain("{}")
  })
  
  it("should handle undefined extra parameter", () => {
    process.env["OPENCODE_CLAUDE_PROVIDER_DEBUG"] = "1"
    claudeLog("test")
    expect(consoleSpy).toHaveBeenCalled()
  })
})
