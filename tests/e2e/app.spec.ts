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
