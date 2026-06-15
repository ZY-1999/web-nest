import { test, expect } from './fixtures/electronApp';
import { waitForWindowReady } from './helpers/windowHelpers';

test('settings button is visible in titlebar', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  const settingsBtn = mainWindow.locator('[data-testid="open-settings"]');
  await expect(settingsBtn).toBeVisible();
});

test('clicking settings button opens dialog', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  await mainWindow.locator('[data-testid="open-settings"]').click();

  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
});

test('settings dialog shows all sections', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  await mainWindow.locator('[data-testid="open-settings"]').click();

  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Section headings should be visible
  await expect(dialog.locator('text=Appearance')).toBeVisible();
  await expect(dialog.locator('text=General')).toBeVisible();
  await expect(dialog.locator('text=Network')).toBeVisible();
  await expect(dialog.locator('text=Advanced')).toBeVisible();
});

test('settings dialog shows language selector with valid locale', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  await mainWindow.locator('[data-testid="open-settings"]').click();

  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Language dropdown should exist with a valid locale (en or zh-CN depending on system)
  const langSelect = dialog.locator('[data-testid="settings-locale-select"]');
  await expect(langSelect).toBeVisible();
  const value = await langSelect.inputValue();
  expect(['en', 'zh-CN']).toContain(value);
});

test('cancel closes settings dialog without saving', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  await mainWindow.locator('[data-testid="open-settings"]').click();

  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Record current locale
  const langSelect = dialog.locator('[data-testid="settings-locale-select"]');
  const currentLocale = await langSelect.inputValue();

  // Change language to the other option
  const targetLocale = currentLocale === 'en' ? 'zh-CN' : 'en';
  await langSelect.selectOption(targetLocale);

  // Click Cancel
  await dialog.locator('[data-testid="settings-cancel"]').click();

  // Dialog should close
  await expect(dialog).not.toBeVisible();

  // Re-open and verify language was NOT saved (should still be original)
  await mainWindow.locator('[data-testid="open-settings"]').click();
  const dialog2 = mainWindow.locator('[role="dialog"]');
  await expect(dialog2).toBeVisible();
  await expect(dialog2.locator('[data-testid="settings-locale-select"]')).toHaveValue(currentLocale);
});

test('save persists language change', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  await mainWindow.locator('[data-testid="open-settings"]').click();

  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Record current locale, pick the other one
  const langSelect = dialog.locator('[data-testid="settings-locale-select"]');
  const currentLocale = await langSelect.inputValue();
  const targetLocale = currentLocale === 'en' ? 'zh-CN' : 'en';
  await langSelect.selectOption(targetLocale);

  // Click Save
  await expect(dialog.locator('[data-testid="settings-save"]')).toBeEnabled();
  await dialog.locator('[data-testid="settings-save"]').click();

  // Dialog should close
  await expect(dialog).not.toBeVisible();

  // Re-open and verify language is now the target
  await mainWindow.locator('[data-testid="open-settings"]').click();
  const dialog2 = mainWindow.locator('[role="dialog"]');
  await expect(dialog2).toBeVisible();
  await expect(dialog2.locator('[data-testid="settings-locale-select"]')).toHaveValue(targetLocale);
});

test('disableGpu toggle shows restart hint when changed', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  await mainWindow.locator('[data-testid="open-settings"]').click();

  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Restart hint should NOT be visible initially
  const restartHint = dialog.locator('text=restart');
  await expect(restartHint).not.toBeVisible();

  // Toggle GPU checkbox
  await dialog.locator('[data-testid="settings-disableGpu-checkbox"]').check();

  // Restart hint should appear
  await expect(restartHint).toBeVisible();
});

test('proxy fields appear when proxy mode is not none', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  await mainWindow.locator('[data-testid="open-settings"]').click();

  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Proxy mode dropdown — default is 'none', host/port should be hidden
  const proxySelect = dialog.locator('[data-testid="settings-proxy-mode-select"]');
  await expect(proxySelect).toHaveValue('none');

  // Switch to HTTP proxy
  await proxySelect.selectOption('http');

  // Host and port fields should appear
  await expect(dialog.locator('[data-testid="settings-proxy-host"]')).toBeVisible();
  await expect(dialog.locator('[data-testid="settings-proxy-port"]')).toBeVisible();
  await expect(dialog.locator('[data-testid="settings-test-proxy"]')).toBeVisible();
});

test('save persists proxy settings', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);
  await mainWindow.locator('[data-testid="open-settings"]').click();

  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Set HTTP proxy with host and port
  await dialog.locator('[data-testid="settings-proxy-mode-select"]').selectOption('http');
  await dialog.locator('[data-testid="settings-proxy-host"]').fill('proxy.example.com');
  await dialog.locator('[data-testid="settings-proxy-port"]').fill('3128');

  // Save
  await expect(dialog.locator('[data-testid="settings-save"]')).toBeEnabled();
  await dialog.locator('[data-testid="settings-save"]').click();
  await expect(dialog).not.toBeVisible();

  // Re-open and verify
  await mainWindow.locator('[data-testid="open-settings"]').click();
  const dialog2 = mainWindow.locator('[role="dialog"]');
  await expect(dialog2).toBeVisible();
  await expect(dialog2.locator('[data-testid="settings-proxy-mode-select"]')).toHaveValue('http');
  await expect(dialog2.locator('[data-testid="settings-proxy-host"]')).toHaveValue('proxy.example.com');
  await expect(dialog2.locator('[data-testid="settings-proxy-port"]')).toHaveValue('3128');
});
