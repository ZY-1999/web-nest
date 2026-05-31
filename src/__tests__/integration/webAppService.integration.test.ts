import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebAppMainApi } from '@/shared/services';

describe('WebAppService integration', () => {
  let webAppService: WebAppMainApi;

  beforeEach(async () => {
    vi.resetModules();
    const { WebAppService } = await import('@/main/services/webAppService');
    webAppService = new WebAppService();
  });

  it('creates a web app and returns state', async () => {
    const state = await webAppService.createWebApp('https://example.com');

    expect(state.id).toMatch(/^webapp-/);
    expect(state.url).toBe('https://example.com');
    expect(state.title).toBeTruthy();
  });

  it('lists created web apps', async () => {
    const app1 = await webAppService.createWebApp('https://example.com');
    const app2 = await webAppService.createWebApp('https://github.com');

    const apps = await webAppService.listWebApps();
    expect(apps).toHaveLength(2);
    expect(apps.find((a) => a.id === app1.id)).toBeDefined();
    expect(apps.find((a) => a.id === app2.id)).toBeDefined();
  });

  it('closes a web app and removes it from list', async () => {
    const app = await webAppService.createWebApp('https://example.com');

    await webAppService.closeWebApp(app.id);

    const apps = await webAppService.listWebApps();
    expect(apps).toHaveLength(0);
  });

  it('closes a non-existent web app without error', async () => {
    await expect(webAppService.closeWebApp('non-existent-id')).resolves.toBeUndefined();
  });

  it('creates multiple web apps and closes them independently', async () => {
    const app1 = await webAppService.createWebApp('https://example.com');
    const app2 = await webAppService.createWebApp('https://github.com');

    await webAppService.closeWebApp(app1.id);

    const apps = await webAppService.listWebApps();
    expect(apps).toHaveLength(1);
    expect(apps[0]!.id).toBe(app2.id);
  });
});
