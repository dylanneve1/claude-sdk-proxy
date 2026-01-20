import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { claudeLog } from "./logger"

let patchApplied = false
let patchPromise: Promise<void> | null = null

const IMPORT_PATHS = {
  RELATIVE_PROVIDER: "../../opencode/packages/opencode/src/provider/provider.ts",
  INSTALLED_PROVIDER: "opencode/provider/provider"
} as const

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))

function resolveMonorepoProviderFileUrl(): string {
  const absolutePath = path.resolve(MODULE_DIR, IMPORT_PATHS.RELATIVE_PROVIDER)
  return pathToFileURL(absolutePath).href
}

interface ProviderState {
  models: Map<string, { value: unknown; timestamp: number }>
  providers: Record<string, ProviderInfo>
}

interface ProviderInfo {
  source: string
  info: {
    id: string
    npm?: string
    name: string
    models: Record<string, ModelInfo>
  }
  options: Record<string, unknown>
}

interface ModelInfo {
  id: string
  name: string
  reasoning?: boolean
  cost?: { input: number; output: number }
  limit?: { context: number; output: number }
}

interface ProviderModule {
  Provider: {
    getModel: (providerID: string, modelID: string) => Promise<unknown>
    ModelNotFoundError: new (params: { providerID: string; modelID: string }) => Error
    InitError: new (params: { providerID: string }, options?: { cause?: Error }) => Error
  }
}

const PROVIDER_IMPORT_STRATEGIES = [
  { name: "file_url_absolute", getPath: () => resolveMonorepoProviderFileUrl() },
  { name: "relative_typescript", getPath: () => IMPORT_PATHS.RELATIVE_PROVIDER },
  { name: "installed_package", getPath: () => IMPORT_PATHS.INSTALLED_PROVIDER }
] as const

function isValidProviderModule(moduleObject: unknown): moduleObject is ProviderModule {
  return !!(
    moduleObject &&
    typeof moduleObject === "object" &&
    "Provider" in moduleObject &&
    moduleObject.Provider &&
    typeof (moduleObject.Provider as Record<string, unknown>).getModel === "function"
  )
}

async function importProviderModule(): Promise<ProviderModule> {
  const errors: string[] = []
  
  for (const strategy of PROVIDER_IMPORT_STRATEGIES) {
    try {
      const moduleObject = await import(strategy.getPath())
      if (isValidProviderModule(moduleObject)) {
        claudeLog("import.success", { strategy: strategy.name })
        return moduleObject
      }
    } catch (error) {
      errors.push(`${strategy.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  throw new Error(`Failed to import Provider module. Tried:\n${errors.join("\n")}`)
}

const FACTORY_EXTRACTION_STRATEGIES = [
  { name: "named_export", extract: (mod: Record<string, unknown>) => mod.createClaudeMaxProvider },
  { name: "default_function", extract: (mod: Record<string, unknown>) => mod.default },
  { name: "default_named", extract: (mod: Record<string, unknown>) => (mod.default as Record<string, unknown>)?.createClaudeMaxProvider }
] as const

function extractFactory(moduleObject: unknown, modulePath: string): () => { languageModel: (id: string) => unknown } {
  if (!moduleObject || typeof moduleObject !== "object") {
    throw new Error(`Factory module is null/undefined: ${modulePath}`)
  }
  
  for (const strategy of FACTORY_EXTRACTION_STRATEGIES) {
    try {
      const factory = strategy.extract(moduleObject as Record<string, unknown>)
      if (typeof factory === "function") {
        return factory as () => { languageModel: (id: string) => unknown }
      }
    } catch {
      continue
    }
  }
  
  const exports = Object.keys(moduleObject as Record<string, unknown>).join(", ")
  throw new Error(`Factory not found in ${modulePath}. Available exports: ${exports}`)
}

function createDefaultPatchState(): ProviderState {
  return {
    models: new Map(),
    providers: {
      "claude-max": {
        source: "config",
        info: {
          id: "claude-max",
          npm: "opencode-claude-code-provider",
          name: "Claude Max",
          models: {
            "claude-max-opus": {
              id: "claude-max-opus",
              name: "Claude Opus 4.5 (Max)",
              reasoning: true,
              limit: { context: 200000, output: 32000 }
            },
            "claude-max-sonnet": {
              id: "claude-max-sonnet",
              name: "Claude Sonnet 4.5 (Max)",
              reasoning: true,
              limit: { context: 200000, output: 16000 }
            },
            "claude-max-opus-thinking": {
              id: "claude-max-opus-thinking",
              name: "Claude Opus 4.5 (Max + Thinking)",
              reasoning: true,
              limit: { context: 200000, output: 32000 }
            }
          }
        },
        options: {
          providerFactory: "opencode-claude-code-provider/provider"
        }
      }
    }
  }
}

async function loadCustomFactory(
  factoryModule: string,
  modelID: string,
  providerID: string
): Promise<unknown> {
  const moduleObject = await import(factoryModule)
  const factory = extractFactory(moduleObject, factoryModule)
  return factory().languageModel(modelID)
}

async function handleModelRequest(
  providerID: string,
  modelID: string,
  patchState: ProviderState,
  originalGetModel: (providerID: string, modelID: string) => Promise<unknown>
): Promise<unknown> {
  const cacheKey = `${providerID}/${modelID}`
  
  const cached = patchState.models.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.value
  }
  
  const providerConfig = patchState.providers[providerID]
  if (!providerConfig) {
    return originalGetModel(providerID, modelID)
  }
  
  const modelInfo = providerConfig.info.models[modelID]
  if (!modelInfo) {
    throw new Error(`Model ${modelID} not found for provider ${providerID}`)
  }
  
  const factoryModule = providerConfig.options.providerFactory
  if (typeof factoryModule !== "string") {
    return originalGetModel(providerID, modelID)
  }
  
  claudeLog("patch.factory_detected", { providerID, factoryModule })
  
  const languageModel = await loadCustomFactory(factoryModule, modelID, providerID)
  
  claudeLog("patch.model_loaded", { providerID, modelID, source: "custom-factory" })
  
  const result = {
    modelID,
    providerID,
    info: modelInfo,
    language: languageModel,
    npm: providerConfig.info.npm
  }
  
  patchState.models.set(cacheKey, { value: result, timestamp: Date.now() })
  
  return result
}

async function applyProviderFactoryPatchInternal(): Promise<void> {
  if (patchApplied) {
    claudeLog("patch.already_applied", {})
    return
  }
  
  try {
    const ProviderModule = await importProviderModule()
    const originalGetModel = ProviderModule.Provider.getModel
    const patchState = createDefaultPatchState()
    
    ;(ProviderModule.Provider as Record<string, unknown>).state = async () => patchState
    
    ProviderModule.Provider.getModel = async function patchedGetModel(
      providerID: string,
      modelID: string
    ) {
      return handleModelRequest(providerID, modelID, patchState, originalGetModel)
    }
    
    patchApplied = true
    claudeLog("patch.applied_successfully", {})
  } catch (error) {
    claudeLog("patch.application_failed", { 
      error: error instanceof Error ? error.message : String(error) 
    })
    throw error
  }
}

export function applyProviderFactoryPatch(): Promise<void> {
  if (patchPromise) return patchPromise
  
  patchPromise = applyProviderFactoryPatchInternal()
    .catch((error) => {
      patchPromise = null
      throw error
    })
    .then(() => {
      patchPromise = null
    })
  
  return patchPromise
}

export function isPatchApplied(): boolean {
  return patchApplied
}

export function resetPatchState(): void {
  patchApplied = false
  patchPromise = null
}
