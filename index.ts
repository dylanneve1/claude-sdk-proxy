import type { Plugin, Hooks } from "@opencode-ai/plugin"

const PROVIDER_ID = "claude-max"
const PROXY_BASE_URL = "http://127.0.0.1:3456/v1"

export const ClaudeMaxProviderPlugin: Plugin = async () => {
  return {
    auth: {
      provider: PROVIDER_ID,
      async loader() {
        return {
          apiKey: "claude-max-via-proxy",
          baseURL: PROXY_BASE_URL,
          async fetch(input: Request | string | URL, init?: RequestInit): Promise<Response> {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
            return fetch(url, init)
          }
        }
      },
      methods: [
        {
          type: "api" as const,
          label: "Claude Max (via local proxy)",
          async authorize() {
            return {
              type: "success" as const,
              key: "claude-max-proxy-key"
            }
          }
        }
      ]
    },
    async config(config) {
      config.provider = config.provider ?? {}
      
      const defaultModels = {
        "opus": {
          name: "Claude Opus (Max)",
          limit: { context: 200000, output: 32000 }
        },
        "sonnet": {
          name: "Claude Sonnet (Max)",
          limit: { context: 200000, output: 16000 }
        }
      }

      const existing = config.provider[PROVIDER_ID] ?? {}

      config.provider[PROVIDER_ID] = {
        ...existing,
        name: existing.name ?? "Claude Max",
        models: {
          ...defaultModels,
          ...(existing.models ?? {})
        }
      }
    }
  } satisfies Hooks
}

export default ClaudeMaxProviderPlugin
