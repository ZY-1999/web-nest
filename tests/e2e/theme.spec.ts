import { test, expect } from './fixtures/electronApp';
import { waitForWindowReady } from './helpers/windowHelpers';

test('app loads with light theme by default', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  const toggle = mainWindow.locator('[data-testid="theme-toggle"]');
  await expect(toggle).toBeVisible();

  // Verify light background applied
  const bgColor = await mainWindow.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  });
  expect(bgColor).toBe('#f8fafc');
});

test('clicking toggle switches to dark theme', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  const toggle = mainWindow.locator('[data-testid="theme-toggle"]');
  await expect(toggle).toBeVisible();

  await toggle.click();

  // Verify dark tokens applied
  const bgColor = await mainWindow.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  });
  expect(bgColor).toBe('#0f172a');
});

test('theme persists after reload', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  const toggle = mainWindow.locator('[data-testid="theme-toggle"]');
  await expect(toggle).toBeVisible();

  // Switch to dark
  await toggle.click();

  // Reload
  await mainWindow.reload();
  await mainWindow.waitForLoadState('domcontentloaded');
  await mainWindow.waitForSelector('[data-testid="theme-toggle"]');

  // Dark theme should persist (main process holds state)
  const bgColor = await mainWindow.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  });
  expect(bgColor).toBe('#0f172a');
});
