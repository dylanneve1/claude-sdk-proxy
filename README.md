# claude-proxy

A drop-in Anthropic Messages API proxy backed by the **Claude Agent SDK**. Use your Claude Max subscription with any Anthropic API client — zero API cost.

```
Any Anthropic client → claude-proxy (:3456) → Claude Agent SDK → Claude Max
```

## Features

- **Drop-in replacement** — set `ANTHROPIC_BASE_URL=http://127.0.0.1:3456` and go
- **Zero cost** — routes through your Claude Max subscription via the Agent SDK
- **Full tool use** — proper `tool_use` content blocks, `stop_reason: "tool_use"`, `input_json_delta` streaming
- **Built-in agent tools** — Claude has access to Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
- **`/v1/models` + `/v1/models/:id`** — model listing and lookup
- **`/v1/messages/count_tokens`** — rough token estimates
- **Streaming SSE** — `message_start` emitted immediately; 15s heartbeat keeps connections alive
- **Inbound images** — base64 image blocks saved to temp files for Claude to read
- **Tool result truncation** — 4000 char cap prevents context explosion
- **Per-request isolation** — fresh MCP server per request, no shared state

## Architecture

### Agent mode (no caller tools)
```
POST /v1/messages
  → Serialize messages → prompt
  → Claude Agent SDK query() (maxTurns=50)
       ├─ Built-in tools: Read, Write, Edit, Bash, Glob, Grep, ...
       └─ MCP tools: message (optional gateway delivery)
```

### Client tool mode (caller provides tools)
```
POST /v1/messages  with  "tools": [...]
  → Inject tool definitions into prompt (all built-in tools disabled)
  → Claude Agent SDK query() (maxTurns=1)
       → Parse <tool_use> blocks → emit tool_use content blocks
```

Client tool mode is auto-detected when the request has a `tools` array and the system prompt doesn't contain agent session markers.

## Quick Start

### Prerequisites

1. **Claude Max subscription** + Claude CLI:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude login
   ```

2. **Bun** runtime:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

### Install & Run

```bash
# From npm
bunx claude-proxy

# Or clone and run
git clone https://github.com/dylanneve1/claude-proxy
cd claude-proxy
bun install
bun run proxy
# Proxy listening at http://127.0.0.1:3456
```

### Usage

```bash
# Any Anthropic SDK
ANTHROPIC_BASE_URL=http://127.0.0.1:3456 ANTHROPIC_API_KEY=dummy your-app

# Python
import anthropic
client = anthropic.Anthropic(base_url="http://127.0.0.1:3456", api_key="dummy")
```

### systemd (Linux auto-start)

```ini
[Unit]
Description=Claude Max API Proxy
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/claude-proxy
ExecStart=/home/user/.bun/bin/bun run proxy
Restart=always
RestartSec=3
Environment=CLAUDE_PROXY_PORT=3456

[Install]
WantedBy=default.target
```

## Testing

```bash
# Unit tests (no running proxy needed)
bun test

# Integration tests (requires running proxy + Claude CLI auth)
bun run test:integration

# All tests
bun run test:all
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_PROXY_PORT` | `3456` | Proxy listen port |
| `CLAUDE_PROXY_HOST` | `127.0.0.1` | Proxy bind address |
| `OPENCODE_CLAUDE_PROVIDER_DEBUG` | unset | Enable debug logging |

## Model Mapping

| Request model string | Claude SDK tier |
|---------------------|-----------------|
| `*opus*` | opus |
| `*haiku*` | haiku |
| anything else | sonnet |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check / service info |
| `GET` | `/v1/models` | List available models |
| `GET` | `/v1/models/:id` | Get model details |
| `POST` | `/v1/messages` | Create a message (streaming or non-streaming) |
| `POST` | `/v1/messages/count_tokens` | Estimate token count |

All endpoints are also available without the `/v1` prefix.

## MCP Message Tool (optional)

The proxy includes an optional `message` MCP tool (`mcp__opencode__message`) for gateway-based message delivery. When this tool delivers a message, the proxy automatically suppresses its text response to prevent double-delivery — no special sentinel values needed from Claude.

| Param | Required | Description |
|-------|----------|-------------|
| `to` | yes | Chat ID |
| `message` | one of | Text to send |
| `filePath` / `path` / `media` | one of | Path to file — converted to `file://` URL |
| `caption` | | Caption for media |

## License

MIT
