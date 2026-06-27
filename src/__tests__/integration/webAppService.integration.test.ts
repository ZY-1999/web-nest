import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebAppMainApi } from '@/shared/services';
import { appConfigService } from '@/main/services/appConfigService';
import { paths } from '@/main/utils/paths';

describe('WebAppService integration', () => {
  let webAppService: WebAppMainApi;

  beforeEach(async () => {
    // Clear persisted apps to prevent cross-test pollution
    appConfigService.saveApps(paths.getConfigDir(), []);

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

  it('createWebApp with service returns 服务型 state and persists service', async () => {
    const state = await webAppService.createWebApp('http://localhost:3000', {
      command: 'npm run dev',
      shell: 'auto',
    });

    expect(state.url).toBe('http://localhost:3000');
    expect(state.service).toEqual({ command: 'npm run dev', shell: 'auto' });

    // 透传：listWebApps 也带 service
    const apps = await webAppService.listWebApps();
    expect(apps.find((a) => a.id === state.id)?.service).toEqual({
      command: 'npm run dev',
      shell: 'auto',
    });
  });

  it('createWebApp without service returns 普通型 state (service undefined)', async () => {
    const state = await webAppService.createWebApp('https://example.com');

    expect(state.service).toBeUndefined();
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

  // ── Spec 01：服务型 web app 数据契约 ──────────────────────────────
  it('updateWebApp service 三态：null=清除（转普通型）', async () => {
    const created = await webAppService.createWebApp('http://localhost:3000', {
      command: 'npm run dev',
      shell: 'bash',
    });
    expect(created.service).toBeDefined();

    const cleared = await webAppService.updateWebApp(created.id, { service: null });
    expect(cleared.service).toBeUndefined();

    // 持久化也清除：listWebApps 透传 undefined
    const apps = await webAppService.listWebApps();
    expect(apps.find((a) => a.id === created.id)?.service).toBeUndefined();
  });

  it('updateWebApp service 三态：undefined=不动', async () => {
    const created = await webAppService.createWebApp('http://localhost:3000', {
      command: 'npm run dev',
      shell: 'bash',
    });
    // 只改 title，service 不传 → service 保持
    const updated = await webAppService.updateWebApp(created.id, { title: 'New Title' });
    expect(updated.title).toBe('New Title');
    expect(updated.service).toEqual({ command: 'npm run dev', shell: 'bash' });
  });

  it('updateWebApp service 三态：object=设置（普通型→服务型互转）', async () => {
    const created = await webAppService.createWebApp('https://example.com');
    expect(created.service).toBeUndefined();

    const serviced = await webAppService.updateWebApp(created.id, {
      service: { command: 'npm start', shell: 'auto' },
    });
    expect(serviced.service).toEqual({ command: 'npm start', shell: 'auto' });
  });

  it('createWebApp shell 空兜底为 auto', async () => {
    const state = await webAppService.createWebApp('http://localhost:3000', {
      command: 'npm run dev',
      shell: '',
    });
    expect(state.service).toEqual({ command: 'npm run dev', shell: 'auto' });
  });

  it('updateWebApp shell 空兜底为 auto', async () => {
    const created = await webAppService.createWebApp('https://example.com');
    const updated = await webAppService.updateWebApp(created.id, {
      service: { command: 'npm start', shell: '   ' },
    });
    expect(updated.service).toEqual({ command: 'npm start', shell: 'auto' });
  });

  it('createWebApp service 存在但 command 空 → 拒绝', async () => {
    await expect(
      webAppService.createWebApp('http://localhost:3000', { command: '', shell: 'auto' }),
    ).rejects.toThrow();
  });

  it('createWebApp service 存在但 url 空 → 拒绝', async () => {
    await expect(
      webAppService.createWebApp('', { command: 'npm run dev', shell: 'auto' }),
    ).rejects.toThrow();
  });

  it('updateWebApp service command 空 → 拒绝', async () => {
    const created = await webAppService.createWebApp('https://example.com');
    await expect(
      webAppService.updateWebApp(created.id, { service: { command: '', shell: 'auto' } }),
    ).rejects.toThrow();
  });
});
