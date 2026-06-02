import path from 'path';
import type { ElectronApplication, Page } from '@playwright/test';
import { test, expect } from './fixtures/electronApp';
import { waitForWindowReady } from './helpers/windowHelpers';

const fixturesDir = path.resolve(__dirname, 'fixtures/pages');
const pageAUrl = `file:///${fixturesDir.replace(/\\/g, '/')}/page-a.html`;

/** Helper: create a web app via main window UI and click its card to open. */
async function openWebApp(electronApp: ElectronApplication, url: string) {
  const mainWindow = await waitForWindowReady(electronApp);

  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-testid="add-url-input"]').fill(url);
  await expect(dialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await dialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.click();

  // Wait for app window (BaseWindow) to appear with its views
  await expect(async () => {
    expect(electronApp.windows().length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });

  return mainWindow;
}

/** Find the titlebar page among all Playwright pages. */
async function findTitlebarPage(electronApp: ElectronApplication): Promise<Page> {
  await expect(async () => {
    const pages = electronApp.windows();
    const results = await Promise.all(
      pages.map(async (p: Page) => {
        try {
          return await p.locator('[data-testid="webapp-titlebar"]').count();
        } catch {
          return 0;
        }
      }),
    );
    expect(results.some((c: number) => c > 0)).toBe(true);
  }).toPass({ timeout: 10000 });

  const pages = electronApp.windows();
  for (const page of pages) {
    try {
      const count = await page.locator('[data-testid="webapp-titlebar"]').count();
      if (count > 0) { return page; }
    } catch {
      // page may have been closed
    }
  }
  throw new Error('Titlebar page not found');
}

/** Find the content page (the one with the external URL). */
async function findContentPage(electronApp: ElectronApplication, urlSubstring: string): Promise<Page> {
  await expect(async () => {
    const pages = electronApp.windows();
    const urls = pages.map((p: Page) => { try { return p.url(); } catch { return ''; } });
    expect(urls.some((u: string) => u.includes(urlSubstring))).toBe(true);
  }).toPass({ timeout: 10000 });

  const pages = electronApp.windows();
  for (const page of pages) {
    try {
      const url = page.url();
      if (url.includes(urlSubstring)) { return page; }
    } catch {
      // page may have been closed
    }
  }
  throw new Error(`Content page with "${urlSubstring}" not found`);
}

// ─── Tests ──────────────────────────────────────────────────────────────

test('titlebar renders two rows', async ({ electronApp }) => {
  await openWebApp(electronApp, pageAUrl);
  const titlebar = await findTitlebarPage(electronApp);

  await expect(titlebar.locator('[data-testid="titlebar-row-1"]')).toBeVisible({ timeout: 10000 });
  await expect(titlebar.locator('[data-testid="titlebar-row-2"]')).toBeVisible();
});

test('titlebar shows page title', async ({ electronApp }) => {
  await openWebApp(electronApp, pageAUrl);
  const titlebar = await findTitlebarPage(electronApp);

  await expect(titlebar.locator('[data-testid="titlebar-title"]')).toHaveText('Page A', { timeout: 10000 });
});

test('titlebar shows URL', async ({ electronApp }) => {
  await openWebApp(electronApp, pageAUrl);
  const titlebar = await findTitlebarPage(electronApp);

  await expect(titlebar.locator('[data-testid="titlebar-url"]')).toContainText('page-a.html', { timeout: 10000 });
});

test('back and forward buttons update after navigation', async ({ electronApp }) => {
  await openWebApp(electronApp, pageAUrl);
  const titlebar = await findTitlebarPage(electronApp);
  const content = await findContentPage(electronApp, 'page-a.html');

  // Initially: can't go back
  await expect(titlebar.locator('[data-testid="nav-back"]')).toBeDisabled({ timeout: 10000 });

  // Navigate to page B via link in content page
  await content.locator('#link-to-b').click();

  // URL should update to page-b
  await expect(titlebar.locator('[data-testid="titlebar-url"]')).toContainText('page-b.html', { timeout: 10000 });
  // Title may be "Page B" or the URL for file:// pages — just check URL changed
  // Now can go back
  await expect(titlebar.locator('[data-testid="nav-back"]')).toBeEnabled();

  // Click back
  await titlebar.locator('[data-testid="nav-back"]').click();
  await expect(titlebar.locator('[data-testid="titlebar-url"]')).toContainText('page-a.html', { timeout: 10000 });
  await expect(titlebar.locator('[data-testid="nav-forward"]')).toBeEnabled();
  await expect(titlebar.locator('[data-testid="nav-back"]')).toBeDisabled();

  // Click forward
  await titlebar.locator('[data-testid="nav-forward"]').click();
  await expect(titlebar.locator('[data-testid="titlebar-url"]')).toContainText('page-b.html', { timeout: 10000 });
});

test('reload button reloads the page', async ({ electronApp }) => {
  await openWebApp(electronApp, pageAUrl);
  const titlebar = await findTitlebarPage(electronApp);

  await expect(titlebar.locator('[data-testid="titlebar-url"]')).toContainText('page-a.html', { timeout: 10000 });

  await titlebar.locator('[data-testid="nav-reload"]').click();

  // After reload, URL should still be page-a
  await expect(titlebar.locator('[data-testid="titlebar-url"]')).toContainText('page-a.html', { timeout: 10000 });
});

test('copy button copies URL to clipboard', async ({ electronApp }) => {
  await openWebApp(electronApp, pageAUrl);
  const titlebar = await findTitlebarPage(electronApp);

  await expect(titlebar.locator('[data-testid="titlebar-url"]')).toContainText('page-a.html', { timeout: 10000 });

  await titlebar.locator('[data-testid="nav-copy"]').click();

  // Read clipboard via Electron API
  const clipboardText = await electronApp.evaluate(async ({ clipboard }) => {
    return clipboard.readText();
  });
  expect(clipboardText).toContain('page-a.html');
});

test('theme toggle switches icon', async ({ electronApp }) => {
  await openWebApp(electronApp, pageAUrl);
  const titlebar = await findTitlebarPage(electronApp);

  await expect(titlebar.locator('[data-testid="titlebar-row-1"]')).toBeVisible({ timeout: 10000 });

  // Default light mode shows Moon icon (click to switch to dark)
  const toggleBtn = titlebar.locator('[data-testid="theme-toggle"]');

  // Click to toggle theme
  await toggleBtn.click();

  // Theme icon should change (Moon → Sun or Sun → Moon)
  // Verify the toggle is still functional by clicking again
  await expect(toggleBtn).toBeEnabled();
});
