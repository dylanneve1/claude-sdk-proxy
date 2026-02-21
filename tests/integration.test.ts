/**
 * Integration tests — run against a live proxy instance.
 *
 * These tests make real requests to the proxy (default http://127.0.0.1:3456)
 * and verify the full request/response cycle through the Claude Agent SDK.
 *
 * Skip these in CI (they need Claude CLI auth). Run locally:
 *   INTEGRATION=1 bun test tests/integration.test.ts
 */
import { describe, test, expect, beforeAll } from "bun:test"

const PROXY_URL = process.env.PROXY_URL || "http://127.0.0.1:3456"
const SKIP = !process.env.INTEGRATION

function skipUnlessIntegration() {
  if (SKIP) {
    console.log("  [SKIPPED - set INTEGRATION=1 to run]")
    return true
  }
  return false
}

async function proxyJson(path: string, init?: RequestInit): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${PROXY_URL}${path}`, init)
  return { status: res.status, body: await res.json(), headers: res.headers }
}

async function proxyPost(path: string, body: object): Promise<{ status: number; body: any; headers: Headers }> {
  return proxyJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "dummy" },
    body: JSON.stringify(body)
  })
}

async function proxyStream(body: object): Promise<{ events: any[]; raw: string }> {
  const res = await fetch(`${PROXY_URL}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "dummy" },
    body: JSON.stringify({ ...body, stream: true })
  })
  const raw = await res.text()
  const events: any[] = []
  for (const line of raw.split("\n")) {
    if (line.startsWith("data: ")) {
      try { events.push(JSON.parse(line.slice(6))) } catch {}
    }
  }
  return { events, raw }
}

// ── Connectivity ─────────────────────────────────────────────────────────────

describe("Integration: connectivity", () => {
  beforeAll(() => { if (SKIP) return })

  test("proxy is reachable", async () => {
    if (skipUnlessIntegration()) return
    const { status, body } = await proxyJson("/")
    expect(status).toBe(200)
    expect(body.status).toBe("ok")
  })
})

// ── Non-streaming messages ───────────────────────────────────────────────────

describe("Integration: non-streaming", () => {
  test("simple math question", async () => {
    if (skipUnlessIntegration()) return
    const { status, body } = await proxyPost("/v1/messages", {
      model: "claude-sonnet-4-6",
      max_tokens: 64,
      stream: false,
      messages: [{ role: "user", content: "What is 7 * 8? Reply with ONLY the number." }]
    })
    expect(status).toBe(200)
    expect(body.type).toBe("message")
    expect(body.role).toBe("assistant")
    expect(body.stop_reason).toBe("end_turn")
    expect(body.content).toBeArray()
    expect(body.content.length).toBeGreaterThan(0)
    expect(body.content[0].type).toBe("text")
    expect(body.content[0].text).toContain("56")
    expect(body.usage).toBeDefined()
    expect(body.usage.input_tokens).toBeGreaterThan(0)
  }, 120_000)

  test("respects model parameter (haiku)", async () => {
    if (skipUnlessIntegration()) return
    const { body } = await proxyPost("/v1/messages", {
      model: "claude-haiku-4-5",
      max_tokens: 32,
      stream: false,
      messages: [{ role: "user", content: "Say 'hello'." }]
    })
    expect(body.model).toBe("claude-haiku-4-5")
    expect(body.content[0].text.toLowerCase()).toContain("hello")
  }, 120_000)
})

// ── Streaming messages ───────────────────────────────────────────────────────

describe("Integration: streaming", () => {
  test("SSE event sequence", async () => {
    if (skipUnlessIntegration()) return
    const { events } = await proxyStream({
      model: "claude-sonnet-4-6",
      max_tokens: 32,
      messages: [{ role: "user", content: "What is 2+2? Reply with ONLY the number." }]
    })
    expect(events.length).toBeGreaterThan(0)

    // Check event types in order
    const types = events.map(e => e.type)
    expect(types[0]).toBe("message_start")
    expect(types).toContain("content_block_start")
    expect(types).toContain("content_block_delta")
    expect(types).toContain("content_block_stop")
    expect(types).toContain("message_delta")
    expect(types[types.length - 1]).toBe("message_stop")

    // message_start should have proper structure
    const msgStart = events[0]
    expect(msgStart.message.type).toBe("message")
    expect(msgStart.message.role).toBe("assistant")
    expect(msgStart.message.stop_reason).toBeNull()

    // message_delta should have stop_reason
    const msgDelta = events.find(e => e.type === "message_delta")
    expect(msgDelta.delta.stop_reason).toBe("end_turn")

    // Text should contain "4"
    const text = events
      .filter(e => e.type === "content_block_delta" && e.delta?.type === "text_delta")
      .map(e => e.delta.text)
      .join("")
    expect(text).toContain("4")
  }, 120_000)
})

// ── Client tool mode ─────────────────────────────────────────────────────────

describe("Integration: client tool mode", () => {
  test("returns tool_use block for provided tools (non-streaming)", async () => {
    if (skipUnlessIntegration()) return
    const { body } = await proxyPost("/v1/messages", {
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      stream: false,
      messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
      tools: [{
        name: "get_weather",
        description: "Get the current weather for a city",
        input_schema: {
          type: "object",
          properties: { city: { type: "string", description: "The city name" } },
          required: ["city"]
        }
      }]
    })
    expect(body.type).toBe("message")

    const toolUseBlock = body.content.find((b: any) => b.type === "tool_use")
    expect(toolUseBlock).toBeDefined()
    expect(toolUseBlock.name).toBe("get_weather")
    expect(toolUseBlock.input).toBeDefined()
    expect(toolUseBlock.id).toBeDefined()
    expect(body.stop_reason).toBe("tool_use")
  }, 120_000)

  test("returns tool_use block for provided tools (streaming)", async () => {
    if (skipUnlessIntegration()) return
    const { events } = await proxyStream({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{ role: "user", content: "What's the weather in London?" }],
      tools: [{
        name: "get_weather",
        description: "Get the current weather for a city",
        input_schema: {
          type: "object",
          properties: { city: { type: "string", description: "The city name" } },
          required: ["city"]
        }
      }]
    })

    // Should have a tool_use content block
    const toolStart = events.find(e =>
      e.type === "content_block_start" && e.content_block?.type === "tool_use"
    )
    expect(toolStart).toBeDefined()
    expect(toolStart.content_block.name).toBe("get_weather")

    // Should have input_json_delta
    const jsonDelta = events.find(e =>
      e.type === "content_block_delta" && e.delta?.type === "input_json_delta"
    )
    expect(jsonDelta).toBeDefined()

    // Stop reason should be tool_use
    const msgDelta = events.find(e => e.type === "message_delta")
    expect(msgDelta.delta.stop_reason).toBe("tool_use")
  }, 120_000)

  test("handles tool_result in conversation", async () => {
    if (skipUnlessIntegration()) return
    const { body } = await proxyPost("/v1/messages", {
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      stream: false,
      messages: [
        { role: "user", content: "What's the weather in Paris?" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "Let me check the weather." },
            { type: "tool_use", id: "toolu_test123", name: "get_weather", input: { city: "Paris" } }
          ]
        },
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "toolu_test123", content: "22°C, sunny" }
          ]
        }
      ],
      tools: [{
        name: "get_weather",
        description: "Get the current weather for a city",
        input_schema: {
          type: "object",
          properties: { city: { type: "string", description: "The city name" } },
          required: ["city"]
        }
      }]
    })
    expect(body.type).toBe("message")
    expect(body.stop_reason).toBe("end_turn")
    const text = body.content.find((b: any) => b.type === "text")?.text || ""
    // Model should reference the weather data
    expect(text.length).toBeGreaterThan(0)
  }, 120_000)
})

// ── Concurrent requests ──────────────────────────────────────────────────────

describe("Integration: concurrency", () => {
  test("handles 3 simultaneous requests", async () => {
    if (skipUnlessIntegration()) return
    const questions = [
      { q: "What is 1+1? Reply ONLY the number.", a: "2" },
      { q: "What is 5*5? Reply ONLY the number.", a: "25" },
      { q: "What is 100/10? Reply ONLY the number.", a: "10" },
    ]
    const results = await Promise.all(
      questions.map(({ q }) => proxyPost("/v1/messages", {
        model: "claude-sonnet-4-6",
        max_tokens: 16,
        stream: false,
        messages: [{ role: "user", content: q }]
      }))
    )
    for (let i = 0; i < questions.length; i++) {
      expect(results[i]!.status).toBe(200)
      expect(results[i]!.body.content[0].text).toContain(questions[i]!.a)
    }
  }, 180_000)
})

// ── System prompt formats ────────────────────────────────────────────────────

describe("Integration: system prompt", () => {
  test("handles string system prompt", async () => {
    if (skipUnlessIntegration()) return
    const { body } = await proxyPost("/v1/messages", {
      model: "claude-sonnet-4-6",
      max_tokens: 32,
      stream: false,
      system: "Always respond in exactly 3 words.",
      messages: [{ role: "user", content: "Hello" }]
    })
    expect(body.content[0].text.split(/\s+/).length).toBeLessThanOrEqual(10)
  }, 120_000)

  test("handles array system prompt", async () => {
    if (skipUnlessIntegration()) return
    const { body } = await proxyPost("/v1/messages", {
      model: "claude-sonnet-4-6",
      max_tokens: 32,
      stream: false,
      system: [{ type: "text", text: "Reply with 'PONG' and nothing else." }],
      messages: [{ role: "user", content: "PING" }]
    })
    expect(body.content[0].text.toUpperCase()).toContain("PONG")
  }, 120_000)
})
