import { mkdirSync, appendFileSync, existsSync } from "fs"
import { join } from "path"

// ── Configuration ────────────────────────────────────────────────────────────

const LOG_DIR = process.env.CLAUDE_PROXY_LOG_DIR ?? "/tmp/claude-proxy"
const LOG_LEVEL_ENV = (process.env.CLAUDE_PROXY_LOG_LEVEL ?? "info").toLowerCase()
const IS_DEBUG =
  process.env["CLAUDE_PROXY_DEBUG"] === "1" ||
  process.env["OPENCODE_CLAUDE_PROVIDER_DEBUG"] === "1"

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const
type LogLevel = keyof typeof LEVELS

const currentLevel: number = IS_DEBUG
  ? LEVELS.debug
  : LEVELS[LOG_LEVEL_ENV as LogLevel] ?? LEVELS.info

// ── File output ──────────────────────────────────────────────────────────────

let currentDateStr = ""
let currentLogPath = ""

function ensureLogDir() {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
    const errDir = join(LOG_DIR, "errors")
    if (!existsSync(errDir)) mkdirSync(errDir, { recursive: true })
  } catch {}
}

ensureLogDir()

function getLogPath(): string {
  const dateStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  if (dateStr !== currentDateStr) {
    currentDateStr = dateStr
    currentLogPath = join(LOG_DIR, `proxy-${dateStr}.log`)
  }
  return currentLogPath
}

function writeToFile(line: string) {
  try {
    appendFileSync(getLogPath(), line + "\n")
  } catch {}
}

// ── Structured JSON logging ──────────────────────────────────────────────────
// Every log line is a single JSON object — parseable by jq, greppable by reqId.
//
// Example:
//   {"ts":"2026-02-23T15:30:00.000Z","level":"info","event":"proxy.request","reqId":"req_abc","model":"haiku"}
//   {"ts":"2026-02-23T15:30:05.000Z","level":"error","event":"proxy.sdk.error","reqId":"req_abc","error":"timeout"}

export interface LogEntry {
  ts: string
  level: LogLevel
  event: string
  reqId?: string
  [key: string]: unknown
}

function emit(level: LogLevel, event: string, data?: Record<string, unknown>) {
  if (LEVELS[level] > currentLevel) return

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  }

  const line = JSON.stringify(entry)

  // Always write to stderr (captured by journalctl)
  console.error(line)

  // Always write to file (persists for post-mortem)
  writeToFile(line)
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Log an error — always emitted. Use for failures, crashes, unexpected states. */
export function logError(event: string, data?: Record<string, unknown>) {
  emit("error", event, data)
}

/** Log a warning — always emitted. Use for degraded states, retries, slow operations. */
export function logWarn(event: string, data?: Record<string, unknown>) {
  emit("warn", event, data)
}

/** Log info — always emitted. Use for request lifecycle events. */
export function logInfo(event: string, data?: Record<string, unknown>) {
  emit("info", event, data)
}

/** Log debug — only when CLAUDE_PROXY_DEBUG=1. Use for verbose details. */
export function logDebug(event: string, data?: Record<string, unknown>) {
  emit("debug", event, data)
}

/** Write an error dump file for a specific request. Returns the file path. */
export function dumpError(reqId: string, data: Record<string, unknown>): string {
  const errDir = join(LOG_DIR, "errors")
  const path = join(errDir, `${reqId}.json`)
  try {
    if (!existsSync(errDir)) mkdirSync(errDir, { recursive: true })
    const content = JSON.stringify({ ts: new Date().toISOString(), reqId, ...data }, null, 2)
    appendFileSync(path, content)
  } catch (e) {
    logError("logger.dump_failed", { reqId, path, error: String(e) })
  }
  return path
}

// ── Legacy API (backward-compatible) ─────────────────────────────────────────
// These are used by existing code. They map to the new structured logging.

/** @deprecated Use logInfo instead */
export const claudeLog = (message: string, extra?: Record<string, unknown>) => {
  logInfo(message, extra)
}

/** @deprecated Use logDebug instead */
export const claudeDebug = (message: string, extra?: Record<string, unknown>) => {
  logDebug(message, extra)
}

export { LOG_DIR }
