# opencode-claude-max-proxy

Use your **Claude Max subscription** ($200/month) with OpenCode instead of paying per-token API costs.

## The Problem

You're paying $200/month for Claude Max which gives you unlimited Claude usage in the Claude apps and CLI. But when you use OpenCode (or any AI coding tool), it connects to the Anthropic API and charges you **per token** - potentially hundreds of dollars on top of your existing subscription.

**You're paying twice for the same AI.**

## The Solution

This proxy sits between OpenCode and your Claude Max subscription:

```
OpenCode → Proxy (localhost:3456) → Claude Agent SDK → Your Claude Max Subscription
```

Instead of hitting the paid Anthropic API, your requests go through the official Claude Agent SDK which uses your existing Claude Max subscription. **Zero additional cost.**

## Is This Legal?

**Yes, 100%.**

This proxy uses the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) - Anthropic's **official, public npm package** designed for exactly this purpose. We're not:

- Reverse engineering anything
- Bypassing authentication
- Violating terms of service
- Modifying Anthropic's code

We simply call `query()` from their SDK and translate the response format. This is the intended use of the SDK.

**You're using your own paid subscription through official channels.**

## Features

| Feature | Description |
|---------|-------------|
| **Zero API costs** | Uses your Claude Max subscription, not per-token billing |
| **Full compatibility** | Works with any Anthropic model in OpenCode |
| **Streaming support** | Real-time SSE streaming just like the real API |
| **Auto-start** | Optional launchd service for macOS |
| **Simple setup** | Two commands to get running |

## Prerequisites

1. **Claude Max subscription** ($200/month) - [Subscribe here](https://claude.ai/settings/subscription)

2. **Claude CLI** installed and authenticated:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude login
   ```

3. **Bun** runtime:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

## Installation

```bash
git clone https://github.com/rynfar/opencode-claude-max-proxy
cd opencode-claude-max-proxy
bun install
```

## Usage

### Start the Proxy

```bash
bun run proxy
```

### Run OpenCode

```bash
ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL=http://127.0.0.1:3456 opencode
```

Select any `anthropic/claude-*` model (opus, sonnet, haiku).

### One-liner

```bash
bun run proxy & ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL=http://127.0.0.1:3456 opencode
```

## Auto-start on macOS

Set up the proxy to run automatically on login:

```bash
cat > ~/Library/LaunchAgents/com.claude-max-proxy.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.claude-max-proxy</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which bun)</string>
        <string>run</string>
        <string>proxy</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$(pwd)</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.claude-max-proxy.plist
```

Then add an alias to `~/.zshrc`:

```bash
echo "alias oc='ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL=http://127.0.0.1:3456 opencode'" >> ~/.zshrc
source ~/.zshrc
```

Now just run `oc` to start OpenCode with Claude Max.

## Model Mapping

| OpenCode Model | Claude SDK |
|----------------|------------|
| `anthropic/claude-opus-*` | opus |
| `anthropic/claude-sonnet-*` | sonnet |
| `anthropic/claude-haiku-*` | haiku |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `CLAUDE_PROXY_PORT` | 3456 | Proxy server port |
| `CLAUDE_PROXY_HOST` | 127.0.0.1 | Proxy server host |

## How It Works

1. **OpenCode** sends a request to `http://127.0.0.1:3456/messages` (thinking it's the Anthropic API)
2. **Proxy** receives the request and extracts the messages
3. **Proxy** calls `query()` from the Claude Agent SDK with your prompt
4. **Claude Agent SDK** authenticates using your Claude CLI login (tied to your Max subscription)
5. **Claude** processes the request using your subscription
6. **Proxy** streams the response back in Anthropic SSE format
7. **OpenCode** receives the response as if it came from the real API

The proxy is ~200 lines of TypeScript. No magic, no hacks.

## FAQ

### Why do I need `ANTHROPIC_API_KEY=dummy`?

OpenCode requires an API key to be set, but we never actually use it. The Claude Agent SDK handles authentication through your Claude CLI login. Any non-empty string works.

### Does this work with other tools besides OpenCode?

Yes! Any tool that uses the Anthropic API format can use this proxy. Just point `ANTHROPIC_BASE_URL` to `http://127.0.0.1:3456`.

### What about rate limits?

Your Claude Max subscription has its own usage limits. This proxy doesn't add any additional limits.

### Is my data sent anywhere else?

No. The proxy runs locally on your machine. Your requests go directly to Claude through the official SDK.

## Troubleshooting

### "Authentication failed"

Run `claude login` to authenticate with the Claude CLI.

### "Connection refused"

Make sure the proxy is running: `bun run proxy`

### Proxy keeps dying

Use the launchd service (see Auto-start section) which automatically restarts the proxy.

## License

MIT

## Credits

Built with the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) by Anthropic.
