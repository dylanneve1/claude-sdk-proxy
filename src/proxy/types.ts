export interface ProxyConfig {
  port: number
  host: string
  debug: boolean
  /** Abort if no SDK events received for this long (ms). Resets on every event. */
  stallTimeoutMs: number
  /** Hard max duration for any request (ms). Kills even actively streaming requests. Safety valve. */
  maxDurationMs: number
  /** Hard max output size (chars). Kills request if output exceeds this. Safety valve. */
  maxOutputChars: number
}

export const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  port: 3456,
  host: "127.0.0.1",
  debug: process.env.CLAUDE_PROXY_DEBUG === "1" || process.env.OPENCODE_CLAUDE_PROVIDER_DEBUG === "1",
  stallTimeoutMs: parseInt(process.env.CLAUDE_PROXY_STALL_TIMEOUT_MS ?? "120000", 10),
  maxDurationMs: parseInt(process.env.CLAUDE_PROXY_MAX_DURATION_MS ?? "3600000", 10),   // 1 hour
  maxOutputChars: parseInt(process.env.CLAUDE_PROXY_MAX_OUTPUT_CHARS ?? "500000", 10),  // 500KB
}
