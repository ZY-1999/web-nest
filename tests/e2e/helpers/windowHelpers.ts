import type { ElectronApplication, Page } from '@playwright/test'

export async function getMainWindow(electronApp: ElectronApplication): Promise<Page> {
  return electronApp.firstWindow()
}

export async function waitForWindowReady(
  electronApp: ElectronApplication,
  timeout = 30000,
): Promise<Page> {
  const window = await electronApp.firstWindow({ timeout })
  await window.waitForLoadState('domcontentloaded')
  return window
}

export async function takeScreenshot(
  page: Page,
  path: string,
  options?: {
    fullPage?: boolean
  },
): Promise<void> {
  await page.screenshot({ path, ...options })
}
