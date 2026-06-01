import fs from 'fs';
import os from 'os';
import path from 'path';
import { test as base, _electron as electron, type ElectronApplication } from '@playwright/test'

export const test = base.extend<{
  electronApp: ElectronApplication
  mainProcessLogs: string[]
}>({
  electronApp: async ({}, use) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-nest-e2e-'));

    const app = await electron.launch({
      args: ['./dist/main/index.js'],
      env: {
        ...process.env,
        WEB_NEST_HOME: tmpDir,
      },
    })

    await use(app)
    await app.close()

    fs.rmSync(tmpDir, { recursive: true, force: true });
  },

  mainProcessLogs: async ({ electronApp }, use, testInfo) => {
    const logs: string[] = []

    const collect = (label: string) => (data: Buffer) => {
      const lines = data
        .toString()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      for (const line of lines) {
        logs.push(`[${label}] ${line}`)
      }
    }

    electronApp.process().stdout?.on('data', collect('main:out'))
    electronApp.process().stderr?.on('data', collect('main:err'))

    await use(logs)

    // Attach logs to Playwright report on failure
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      if (logs.length > 0) {
        await testInfo.attach('main-process-logs', {
          body: logs.join('\n'),
          contentType: 'text/plain',
        })
        // Also print to console for immediate visibility
        console.log(`\n===== Main Process Logs (${testInfo.title}) =====`)
        for (const line of logs) {
          console.log(line)
        }
        console.log('===== End Main Process Logs =====\n')
      }
    }
  },
})

export { expect } from '@playwright/test'
