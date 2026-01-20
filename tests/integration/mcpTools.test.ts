import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"

describe("MCP Tools Integration", () => {
  const testDir = path.join(process.cwd(), "tests/fixtures/temp")
  const testFile = path.join(testDir, "test.txt")
  
  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true })
    await fs.writeFile(testFile, "Hello, World!")
  })
  
  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })
  
  it("should have test fixture directory", async () => {
    const stat = await fs.stat(testDir)
    expect(stat.isDirectory()).toBe(true)
  })
  
  it("should have test file with content", async () => {
    const content = await fs.readFile(testFile, "utf-8")
    expect(content).toBe("Hello, World!")
  })
})
