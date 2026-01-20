import { describe, it, expect, beforeEach } from "bun:test"
import { 
  isPatchApplied, 
  resetPatchState 
} from "../../src/monkeyPatch"

describe("monkeyPatch", () => {
  beforeEach(() => {
    resetPatchState()
  })
  
  it("should start with patch not applied", () => {
    expect(isPatchApplied()).toBe(false)
  })
  
  it("should export isPatchApplied function", () => {
    expect(typeof isPatchApplied).toBe("function")
  })
  
  it("should export resetPatchState function", () => {
    expect(typeof resetPatchState).toBe("function")
  })
})
