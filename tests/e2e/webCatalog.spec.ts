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

  // Click + card
  await mainWindow.locator('[data-testid="add-card-btn"]').click();

  // Dialog should be visible
  const dialog = mainWindow.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Fill URL and submit
  await dialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await dialog.locator('[data-testid="add-submit"]').click();

  // Wait for card to appear
  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card.locator('p.text-sm')).toHaveText('about:blank');

  // Empty message should be gone
  await expect(mainWindow.locator('[data-testid="empty-message"]')).not.toBeVisible();
});

test('clicking card opens edit dialog and saves title', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app first
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Click card to open edit dialog
  await card.click();

  const editDialog = mainWindow.locator('[role="dialog"]');
  await expect(editDialog).toBeVisible();
  await expect(editDialog.locator('[data-testid="edit-title-input"]')).toHaveValue('about:blank');

  // Update title and save
  await editDialog.locator('[data-testid="edit-title-input"]').fill('My App');
  await editDialog.locator('[data-testid="edit-submit"]').click();

  // Card should show updated title
  await expect(card.locator('p.font-medium')).toHaveText('My App');
});

test('closing a web app removes the card', async ({ electronApp }) => {
  const mainWindow = await waitForWindowReady(electronApp);

  // Create a web app
  await mainWindow.locator('[data-testid="add-card-btn"]').click();
  const addDialog = mainWindow.locator('[role="dialog"]');
  await expect(addDialog).toBeVisible();
  await addDialog.locator('[data-testid="add-url-input"]').fill('about:blank');
  await addDialog.locator('[data-testid="add-submit"]').click();

  const card = mainWindow.locator('[data-testid="webapp-card"]');
  await expect(card).toBeVisible({ timeout: 10000 });

  // Click close button
  await card.locator('[data-testid="webapp-close-btn"]').click();

  // Card should be gone
  await expect(card).not.toBeVisible();
  // Empty message should reappear
  await expect(mainWindow.locator('[data-testid="empty-message"]')).toBeVisible();
});
