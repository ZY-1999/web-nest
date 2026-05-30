import { test as base, _electron as electron } from '@playwright/test'

export const test = base.extend<{
  electronApp: Awaited<ReturnType<typeof electron.launch>>
}>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: ['./dist/main/index.js'],
    })
    await use(app)
    await app.close()
  },
})

export { expect } from '@playwright/test'
