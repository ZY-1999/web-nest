import { test, expect } from './fixtures/electronApp'
import { waitForWindowReady } from './helpers/windowHelpers'

test('app launches, creates main window, and loads React app with resources', async ({
  electronApp,
  mainProcessLogs,
}) => {
  const window = await waitForWindowReady(electronApp)

  const consoleErrors: string[] = []

  window.on('console', (msg) => {
    const msgType = msg.type()
    if (msgType === 'error') {
      const errorText = msg.text()
      consoleErrors.push(errorText)
    }
  })

  const title = await window.title()
  expect(title).toBeTruthy()

  const appElement = window.locator('#root').first()

  await expect(appElement).toBeVisible()

  const loadedResources = await window.evaluate(() => {
    return {
      hasReactRoot: !!document.getElementById('root'),
    }
  })
  expect(loadedResources.hasReactRoot).toBe(true)
  expect(consoleErrors).toEqual([])

  // Verify main process logged window creation
  const hasMainLog = mainProcessLogs.some((l) => l.includes('Main window created successfully'))
  expect(hasMainLog).toBe(true)
})

test('main window devtools button toggles devtools on the main view', async ({ electronApp }) => {
  const window = await waitForWindowReady(electronApp)

  const devtoolsBtn = window.locator('[data-testid="titlebar-devtools"]')
  await expect(devtoolsBtn).toBeVisible({ timeout: 10000 })

  // Inspect the main content view's DevTools state directly
  const mainDevToolsOpen = () =>
    electronApp.evaluate(async ({ webContents }, urlSub: string) => {
      const main = webContents.getAllWebContents().find((wc) => wc.getURL().includes(urlSub))
      return main ? main.isDevToolsOpened() : false
    }, 'index.html')

  // Initially closed
  expect(await mainDevToolsOpen()).toBe(false)

  // First click opens DevTools on the main view
  await devtoolsBtn.click()
  await expect.poll(mainDevToolsOpen, { timeout: 10000 }).toBe(true)

  // Second click closes it (toggle behaviour)
  await devtoolsBtn.click()
  await expect.poll(mainDevToolsOpen, { timeout: 10000 }).toBe(false)
})
