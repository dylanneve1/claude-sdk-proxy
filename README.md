# opencode-claude-code-provider

Use your Claude Max subscription ($200/month) within OpenCode's TUI.

This provides a proxy server that translates Anthropic API requests to Claude Agent SDK calls, allowing OpenCode to use your Claude Max subscription.

## Prerequisites

1. **Claude Code CLI** installed and authenticated:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude login
   ```

2. **OpenCode** version 0.14.4 or higher

## Installation

```bash
git clone https://github.com/yourname/opencode-claude-code-provider
cd opencode-claude-code-provider
bun install
```

## Usage

### Step 1: Start the Proxy Server

```bash
bun run proxy
```

This starts the Claude Max proxy on `http://127.0.0.1:3456`.

### Step 2: Run OpenCode with Environment Variables

```bash
ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL=http://127.0.0.1:3456 opencode
```

Then select any `anthropic/claude-*` model from the model picker.

### One-liner

```bash
bun run proxy &
ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL=http://127.0.0.1:3456 opencode
```

### Convenience Script

Create a shell alias or script:

```bash
#!/bin/bash
cd /path/to/opencode-claude-code-provider
bun run proxy &
PROXY_PID=$!
trap "kill $PROXY_PID 2>/dev/null" EXIT
ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL=http://127.0.0.1:3456 opencode "$@"
```

## Model Mapping

The proxy maps OpenCode model names to Claude Agent SDK models:

| OpenCode Model | Claude SDK Model |
|----------------|------------------|
| `anthropic/claude-opus-*` | opus |
| `anthropic/claude-sonnet-*` | sonnet |
| `anthropic/claude-haiku-*` | haiku |

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  OpenCode                                               │
│  (uses ANTHROPIC_BASE_URL=http://127.0.0.1:3456)        │
└───────────────────────┬─────────────────────────────────┘
                        │ POST /messages
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Claude Max Proxy (Hono server)                         │
│  - Receives Anthropic API format requests               │
│  - Translates to Claude Agent SDK query() calls         │
│  - Streams back Anthropic SSE format                    │
└───────────────────────┬─────────────────────────────────┘
                        │ query()
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Claude Agent SDK                                       │
│  (uses your Claude Max subscription)                    │
└─────────────────────────────────────────────────────────┘
```

## Configuration

### Proxy Port

```bash
PORT=8080 bun run proxy
```

### Proxy Host

```bash
HOST=0.0.0.0 bun run proxy
```

## Development

```bash
bun install
bun test
bun run typecheck
```

## Troubleshooting

### "Authentication failed"
Run `claude login` to authenticate with Claude Code CLI.

### "Connection refused"
Ensure the proxy is running on the expected port.

### Debug mode
```bash
OPENCODE_CLAUDE_PROVIDER_DEBUG=1 bun run proxy
```

## Technical Notes

- The proxy uses the Claude Agent SDK's `query()` function with `maxTurns: 1`
- Streaming responses use Anthropic's SSE format (message_start, content_block_delta, etc.)
- Authentication is handled automatically by the Claude Code CLI

## License

MIT
