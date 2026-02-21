const shouldLog = () =>
  process.env["CLAUDE_PROXY_DEBUG"] === "1" ||
  process.env["OPENCODE_CLAUDE_PROVIDER_DEBUG"] === "1"

export const claudeLog = (message: string, extra?: Record<string, unknown>) => {
  if (!shouldLog()) return
  const ts = new Date().toISOString()
  const parts = [`[${ts}] [claude-proxy]`, message]
  if (extra && Object.keys(extra).length > 0) {
    parts.push(JSON.stringify(extra))
  }
  console.debug(parts.join(" "))
}
