# claude-proxy

A proxy server that bridges **openclaw** (and any Anthropic Messages API client) to the **Claude Agent SDK**, allowing Claude Max subscribers to use openclaw with full Telegram multi-message support.

```
openclaw → claude-proxy (localhost:3456) → Claude Agent SDK → Claude Max subscription
```

## Features

- **Claude Max** — zero API cost, uses your existing subscription via the official Agent SDK
- **Streaming SSE** — full streaming support with correct event ordering
- **Multi-message sends** — Claude can send multiple separate Telegram messages in one turn via the `send_message` MCP tool connected to the openclaw gateway
- **Image support** — inbound media (base64 image blocks) saved to temp files so Claude can read them
- **Tool serialization** — `tool_use` / `tool_result` blocks properly serialized to text for the Agent SDK
- **Concurrent requests** — per-request MCP server instances; no shared state between simultaneous calls
- **NO_REPLY normalization** — responses ending with openclaw's silent token are normalized to just `NO_REPLY`

## Architecture

```
HTTP POST /v1/messages (Anthropic format)
  ↓
Deserialize messages: text + images (→ temp files) + tool_use/tool_result blocks
  ↓
Build prompt: system prompt + SEND_MESSAGE_NOTE + conversation history
  ↓
Claude Agent SDK query() with per-request MCP server
  ↓
MCP tools available:
  • send_message → openclaw gateway WebSocket (Ed25519 device auth, operator.admin scope)
  • read / write / edit / bash / glob / grep
  ↓
Collect all text across multi-turn run, normalize response
  ↓
Return Anthropic SSE stream or JSON response
```

## Setup

### Prerequisites

1. **Claude Max subscription** + Claude CLI authenticated:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude login
   ```

2. **Bun** runtime:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

3. **openclaw** running with gateway enabled (for `send_message` support):
   ```bash
   openclaw gateway
   ```

### Install & Run

```bash
git clone https://github.com/dylanneve1/claude-proxy
cd claude-proxy
bun install
bun run proxy
```

### Configure openclaw

In `~/.openclaw/openclaw.json`, set the provider to point at the proxy:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "claude-proxy/claude-sonnet-4-6"
      }
    }
  }
}
```

Add a provider entry pointing to the proxy:

```json
{
  "providers": {
    "claude-proxy": {
      "type": "anthropic",
      "baseUrl": "http://127.0.0.1:3456"
    }
  }
}
```

### systemd (Linux auto-start)

```ini
[Unit]
Description=Claude Max Proxy
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/claude-proxy
ExecStart=/home/user/.bun/bin/bun run proxy
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now claude-proxy.service
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_PROXY_PORT` | `3456` | Proxy listen port |
| `CLAUDE_PROXY_HOST` | `127.0.0.1` | Proxy bind address |
| `OPENCODE_CLAUDE_PROVIDER_DEBUG` | unset | Enable debug logging |

## Model Mapping

| openclaw model string | Claude SDK tier |
|----------------------|-----------------|
| `*opus*` | opus |
| `*haiku*` | haiku |
| anything else | sonnet |

## Multi-message Sends

When Claude needs to send multiple separate Telegram messages in one turn, it uses the `send_message` MCP tool (backed by the openclaw gateway WebSocket API with Ed25519 device auth). Claude calls it once per message, then outputs `NO_REPLY` so openclaw suppresses the duplicate text delivery.

The gateway auth uses `operator.admin` scope (within the device's paired scope set), which bypasses all method-level scope checks server-side.

## License

MIT
