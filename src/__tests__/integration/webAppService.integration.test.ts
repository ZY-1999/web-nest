import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebAppMainApi } from '@/shared/services';

describe('WebAppService integration', () => {
  let webAppService: WebAppMainApi;

  beforeEach(async () => {
    vi.resetModules();
    const { i18nService } = await import('@/main/services/i18nService');
    i18nService.init();
    const { WebAppService } = await import('@/main/services/webAppService');
    webAppService = new WebAppService();
  });

  it('creates a web app and returns state', async () => {
    const state = await webAppService.createWebApp('https://example.com');

    expect(state.id).toMatch(/^webapp-/);
    expect(state.url).toBe('https://example.com');
    expect(state.title).toBeTruthy();
    expect(state.faviconUrl).toContain('google.com/s2/favicons');
  });

  it('lists created web apps', async () => {
    const app1 = await webAppService.createWebApp('https://example.com');
    const app2 = await webAppService.createWebApp('https://github.com');

    const apps = await webAppService.listWebApps();
    expect(apps).toHaveLength(2);
    expect(apps.find((a) => a.id === app1.id)).toBeDefined();
    expect(apps.find((a) => a.id === app2.id)).toBeDefined();
  });

  it('closes a web app but keeps it in persisted list', async () => {
    const app = await webAppService.createWebApp('https://example.com');

    await webAppService.closeWebApp(app.id);

    const apps = await webAppService.listWebApps();
    expect(apps).toHaveLength(1);
    expect(apps[0]!.id).toBe(app.id);
  });

  it('deletes a web app and removes it from list', async () => {
    const app = await webAppService.createWebApp('https://example.com');

    await webAppService.deleteWebApp(app.id);

    const apps = await webAppService.listWebApps();
    expect(apps).toHaveLength(0);
  });

  it('closes a non-existent web app without error', async () => {
    await expect(webAppService.closeWebApp('non-existent-id')).resolves.toBeUndefined();
  });

  it('deletes a non-existent web app without error', async () => {
    await expect(webAppService.deleteWebApp('non-existent-id')).resolves.toBeUndefined();
  });

  it('re-opens a closed web app', async () => {
    const app = await webAppService.createWebApp('https://example.com');
    await webAppService.closeWebApp(app.id);

    const reopened = await webAppService.openWebApp(app.id);
    expect(reopened.id).toBe(app.id);
    expect(reopened.url).toBe(app.url);
  });

  it('creates multiple web apps and closes them independently', async () => {
    const app1 = await webAppService.createWebApp('https://example.com');
    const app2 = await webAppService.createWebApp('https://github.com');

    await webAppService.closeWebApp(app1.id);

    // Both still in persisted list
    const apps = await webAppService.listWebApps();
    expect(apps).toHaveLength(2);
  });

  it('openWebApp throws for non-existent id', async () => {
    await expect(webAppService.openWebApp('non-existent-id')).rejects.toThrow('Web app not found');
  });

  it('openWebApp returns same app if already open', async () => {
    const created = await webAppService.createWebApp('https://example.com');
    const reopened = await webAppService.openWebApp(created.id);

    expect(reopened.id).toBe(created.id);
    expect(reopened.url).toBe(created.url);
  });

  it('updateWebApp updates title', async () => {
    const created = await webAppService.createWebApp('https://example.com');
    const updated = await webAppService.updateWebApp(created.id, { title: 'New Title' });

    expect(updated.title).toBe('New Title');
    expect(updated.id).toBe(created.id);
  });

  it('updateWebApp throws for non-existent id', async () => {
    await expect(
      webAppService.updateWebApp('non-existent-id', { title: 'x' }),
    ).rejects.toThrow('Web app not found');
  });
});
