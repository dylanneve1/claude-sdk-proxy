/**
 * Unit tests for internal helper functions.
 * These test pure logic without any network or SDK calls.
 */
import { describe, test, expect } from "bun:test"

// We import the server module to test the functions indirectly through the API.
// For functions that aren't exported, we test them through their effects on API responses.

// ── Model mapping ────────────────────────────────────────────────────────────
// Tested via the /v1/messages endpoint's model field in API tests.
// Here we test the logic patterns directly.

describe("model mapping logic", () => {
  function mapModel(model: string): "sonnet" | "opus" | "haiku" {
    if (model.includes("opus")) return "opus"
    if (model.includes("haiku")) return "haiku"
    return "sonnet"
  }

  test("maps opus models", () => {
    expect(mapModel("claude-opus-4-6")).toBe("opus")
    expect(mapModel("claude-opus-4-6-20250801")).toBe("opus")
  })

  test("maps haiku models", () => {
    expect(mapModel("claude-haiku-4-5")).toBe("haiku")
    expect(mapModel("claude-haiku-4-5-20251001")).toBe("haiku")
  })

  test("maps sonnet models", () => {
    expect(mapModel("claude-sonnet-4-6")).toBe("sonnet")
    expect(mapModel("claude-sonnet-4-6-20250801")).toBe("sonnet")
  })

  test("defaults to sonnet for unknown models", () => {
    expect(mapModel("unknown-model")).toBe("sonnet")
    expect(mapModel("gpt-4")).toBe("sonnet")
    expect(mapModel("")).toBe("sonnet")
  })
})

// ── Tool use XML parsing ─────────────────────────────────────────────────────

describe("tool use XML parsing", () => {
  function parseToolUse(text: string) {
    const regex = /<tool_use>([\s\S]*?)<\/tool_use>/g
    const calls: { name: string; input: unknown }[] = []
    let firstIdx = -1
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      if (firstIdx < 0) firstIdx = m.index
      try {
        const p = JSON.parse(m[1]!.trim())
        calls.push({ name: String(p.name ?? ""), input: p.input ?? {} })
      } catch {}
    }
    return { toolCalls: calls, textBefore: firstIdx > 0 ? text.slice(0, firstIdx).trim() : "" }
  }

  test("parses single tool call", () => {
    const text = `<tool_use>{"name": "get_weather", "input": {"city": "Tokyo"}}</tool_use>`
    const { toolCalls, textBefore } = parseToolUse(text)
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]!.name).toBe("get_weather")
    expect(toolCalls[0]!.input).toEqual({ city: "Tokyo" })
    expect(textBefore).toBe("")
  })

  test("parses multiple tool calls", () => {
    const text = `<tool_use>{"name": "a", "input": {}}</tool_use>\n<tool_use>{"name": "b", "input": {"x": 1}}</tool_use>`
    const { toolCalls } = parseToolUse(text)
    expect(toolCalls).toHaveLength(2)
    expect(toolCalls[0]!.name).toBe("a")
    expect(toolCalls[1]!.name).toBe("b")
    expect(toolCalls[1]!.input).toEqual({ x: 1 })
  })

  test("extracts text before tool calls", () => {
    const text = `Let me check that for you.\n<tool_use>{"name": "search", "input": {"q": "test"}}</tool_use>`
    const { toolCalls, textBefore } = parseToolUse(text)
    expect(toolCalls).toHaveLength(1)
    expect(textBefore).toBe("Let me check that for you.")
  })

  test("returns empty for no tool calls", () => {
    const text = "Just a regular message with no tools."
    const { toolCalls, textBefore } = parseToolUse(text)
    expect(toolCalls).toHaveLength(0)
    expect(textBefore).toBe("")
  })

  test("skips malformed JSON inside tool_use tags", () => {
    const text = `<tool_use>not json</tool_use>\n<tool_use>{"name": "valid", "input": {}}</tool_use>`
    const { toolCalls } = parseToolUse(text)
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0]!.name).toBe("valid")
  })
})

// ── Client tool mode detection ───────────────────────────────────────────────

describe("client tool mode detection", () => {
  function isClientToolMode(body: any): boolean {
    if (!body.tools?.length) return false
    if (body.messages?.some((m: any) =>
      Array.isArray(m.content) && m.content.some((b: any) => b.type === "tool_result")
    )) return true
    const sysText = Array.isArray(body.system)
      ? body.system.filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ")
      : String(body.system ?? "")
    if (sysText.includes("conversation_label") || sysText.includes("chat id:")) return false
    return true
  }

  test("false when no tools", () => {
    expect(isClientToolMode({ messages: [{ role: "user", content: "hi" }] })).toBe(false)
  })

  test("false when tools is empty", () => {
    expect(isClientToolMode({ tools: [], messages: [] })).toBe(false)
  })

  test("true when tools provided with normal system prompt", () => {
    expect(isClientToolMode({
      tools: [{ name: "t1" }],
      system: "You are helpful.",
      messages: [{ role: "user", content: "hi" }]
    })).toBe(true)
  })

  test("true when messages contain tool_result", () => {
    expect(isClientToolMode({
      tools: [{ name: "t1" }],
      messages: [
        { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "ok" }] }
      ]
    })).toBe(true)
  })

  test("false when system contains conversation_label (agent mode)", () => {
    expect(isClientToolMode({
      tools: [{ name: "t1" }],
      system: "conversation_label: -123456 | Some Chat",
      messages: [{ role: "user", content: "hi" }]
    })).toBe(false)
  })

  test("false when system contains chat id:", () => {
    expect(isClientToolMode({
      tools: [{ name: "t1" }],
      system: "chat id: 12345",
      messages: [{ role: "user", content: "hi" }]
    })).toBe(false)
  })

  test("false when system is array with conversation_label", () => {
    expect(isClientToolMode({
      tools: [{ name: "t1" }],
      system: [{ type: "text", text: "conversation_label: -123" }],
      messages: [{ role: "user", content: "hi" }]
    })).toBe(false)
  })
})

// ── Rough token estimation ───────────────────────────────────────────────────

describe("rough token estimation", () => {
  function roughTokens(text: string): number {
    return Math.ceil((text ?? "").length / 4)
  }

  test("estimates tokens", () => {
    expect(roughTokens("hello world")).toBe(3) // 11 chars / 4 = 2.75 → 3
  })

  test("handles empty string", () => {
    expect(roughTokens("")).toBe(0)
  })

  test("handles long text", () => {
    const text = "a".repeat(1000)
    expect(roughTokens(text)).toBe(250)
  })
})
