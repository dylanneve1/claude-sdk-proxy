export interface ProxyConfig {
  port: number
  host: string
  debug: boolean
  requestTimeoutMs: number
}

export const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  port: 3456,
  host: "127.0.0.1",
  debug: process.env.CLAUDE_PROXY_DEBUG === "1" || process.env.OPENCODE_CLAUDE_PROVIDER_DEBUG === "1",
  requestTimeoutMs: parseInt(process.env.CLAUDE_PROXY_TIMEOUT_MS ?? "1800000", 10),
}
