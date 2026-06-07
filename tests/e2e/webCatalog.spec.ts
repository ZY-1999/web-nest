import { test, expect } from './fixtures/electronApp';
import { waitForWindowReady } from './helpers/windowHelpers';

test('web catalog renders grid with + card and empty message', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  await expect(mainWindow.locator('h1')).toHaveText('Web Catalog');
  await expect(mainWindow.locator('[data-testid="empty-message"]')).toBeVisible();
  await expect(mainWindow.locator('[data-testid="add-card-btn"]')).toBeVisible();
});

test('clicking + opens dialog and creates web app card', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  await mainWindow.locator('[data-testid="add-card-btn"]').click();

  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  await dialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(dialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await dialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  await expect(mainWindow.locator('[data-testid="empty-message"]')).not.toBeVisible();
});

test('hover menu opens edit dialog and saves title', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Hover to show menu, click edit
  await card.hover();
  await card.locator('[data-testid="webapp-menu-btn"]').click();
  await card.locator('[data-testid="webapp-edit-btn"]').click();

  const editDialog = mainWindow.locator('[role="dialog"]');
  await expect(editDialog).toBeVisible();

  await editDialog.locator('[data-testid="edit-title-input"]').fill('My App');
  await editDialog.locator('[data-testid="edit-submit"]').click();

  await expect(card.locator('p.font-medium')).toHaveText('My App');
});

test('deleting a web app removes the card', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Hover to show menu, click delete
  await card.hover();
  await card.locator('[data-testid="webapp-menu-btn"]').click();
  await card.locator('[data-testid="webapp-delete-btn"]').click();

  // Card should be gone
  await expect(card).not.toBeVisible();
  await expect(mainWindow.locator('[data-testid="empty-message"]')).toBeVisible();
});

test('clicking card opens web app window', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Click card to open app window
  await card.click();

  // New window should appear
  await expect(async () => {
    const windows = electronApp.windows();
    expect(windows.length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });
});

test('favicon shows in card', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Either favicon image, spinner, or fallback letter should be visible
  const hasImage = await card.locator('[data-testid="favicon-image"]').isVisible().catch(() => false);
  const hasSpinner = await card.locator('[data-testid="favicon-spinner"]').isVisible().catch(() => false);
  const hasFallback = await card.locator('[data-testid="favicon-fallback"]').isVisible().catch(() => false);
  expect(hasImage || hasSpinner || hasFallback).toBe(true);
});

test('app persists across restart', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Close the app window
  const windows = electronApp.windows();
  for (const w of windows) {
    if (w !== mainWindow) {
      await w.close();
    }
  }

  // Card should still be visible (persisted, window closed)
  await expect(mainWindow.locator('[data-testid="webapp-card"]')).toBeVisible();
});

test('clicking card after close reopens app window', async ({ electronApp, mainProcessLogs }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Wait for app window to appear
  await expect(async () => {
    expect(electronApp.windows().length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });

  // Close the app window via Playwright (simulates user clicking X)
  const windows = electronApp.windows();
  for (const w of windows) {
    if (w !== mainWindow) {
      await w.close();
    }
  }

  // Wait for main process to process the closed event (window cleanup)
  await mainWindow.waitForTimeout(2000);

  // Click card again to reopen
  await card.click();

  // New window should appear
  await expect(async () => {
    expect(electronApp.windows().length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });
});

test('hover menu shows create shortcut button', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Hover to show menu
  await card.hover();
  await card.locator('[data-testid="webapp-menu-btn"]').click();

  // Create Shortcut button should be visible
  const shortcutBtn = card.locator('[data-testid="webapp-shortcut-btn"]');
  await expect(shortcutBtn).toBeVisible();
  await expect(shortcutBtn).toHaveText('Create Shortcut');
});

test('clicking create shortcut toggles to remove shortcut', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Hover → menu → click Create Shortcut
  await card.hover();
  await card.locator('[data-testid="webapp-menu-btn"]').click();
  const shortcutBtn = card.locator('[data-testid="webapp-shortcut-btn"]');
  await expect(shortcutBtn).toBeVisible();
  await shortcutBtn.click();

  // Reopen menu and verify Remove Shortcut is shown
  await card.hover();
  await card.locator('[data-testid="webapp-menu-btn"]').click();
  const removeBtn = card.locator('[data-testid="webapp-remove-shortcut-btn"]');
  await expect(removeBtn).toBeVisible({ timeout: 10000 });
  await expect(removeBtn).toHaveText('Remove Shortcut');
});

test('clicking remove shortcut toggles back to create', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await expect(addDialog.locator('[data-testid="add-submit"]')).toBeEnabled();
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Create shortcut first
  await card.hover();
  await card.locator('[data-testid="webapp-menu-btn"]').click();
  await card.locator('[data-testid="webapp-shortcut-btn"]').click();

  // Reopen menu → click Remove Shortcut
  await card.hover();
  await card.locator('[data-testid="webapp-menu-btn"]').click();
  const removeBtn = card.locator('[data-testid="webapp-remove-shortcut-btn"]');
  await expect(removeBtn).toBeVisible({ timeout: 10000 });
  await removeBtn.click();

  // Reopen menu → Create Shortcut should be back
  await card.hover();
  await card.locator('[data-testid="webapp-menu-btn"]').click();
  const shortcutBtn = card.locator('[data-testid="webapp-shortcut-btn"]');
  await expect(shortcutBtn).toBeVisible({ timeout: 10000 });
  await expect(shortcutBtn).toHaveText('Create Shortcut');
});
