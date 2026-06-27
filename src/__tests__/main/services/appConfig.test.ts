import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { appConfigService } from '@/main/services/appConfigService';
import type { PersistedApp } from '@/main/services/appConfigService';

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => `/fake/path/${name}`,
  },
}));

describe('paths', () => {
  it('getConfigDir should return ~/.web-nest', async () => {
    // Dynamic import to get fresh module after mock
    const { paths } = await import('@/main/utils/paths');
    const dir = paths.getConfigDir();
    expect(dir).toBe(path.join('/fake/path/home', '.web-nest'));
  });

  it('getCacheDir should return ~/.web-nest/.cache', async () => {
    const { paths } = await import('@/main/utils/paths');
    const dir = paths.getCacheDir();
    expect(dir).toBe(path.join('/fake/path/home', '.web-nest', '.cache'));
  });

  it('getLogDir should return ~/.web-nest/log', async () => {
    const { paths } = await import('@/main/utils/paths');
    const dir = paths.getLogDir();
    expect(dir).toBe(path.join('/fake/path/home', '.web-nest', 'log'));
  });
});

describe('appConfigService', () => {
  const mockApps: PersistedApp[] = [
    { id: 'app-1', url: 'https://example.com', title: 'Example', faviconUrl: 'https://example.com/favicon.ico' },
  ];

  it('loadApps returns empty array when file does not exist', () => {
    const dir = '/tmp/nonexistent-dir-' + Date.now();
    const result = appConfigService.loadApps(dir);
    expect(result).toEqual([]);
  });

  it('saveApps and loadApps round-trip', () => {
    const dir = `/tmp/web-nest-test-${Date.now()}`;
    fs.mkdirSync(dir, { recursive: true });

    appConfigService.saveApps(dir, mockApps);
    const loaded = appConfigService.loadApps(dir);

    expect(loaded).toEqual(mockApps);

    // cleanup
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('saveApps and loadApps round-trip with service config (服务型 web app)', () => {
    const dir = `/tmp/web-nest-test-${Date.now()}`;
    fs.mkdirSync(dir, { recursive: true });

    const appsWithService: PersistedApp[] = [
      {
        id: 'app-svc',
        url: 'http://localhost:3000',
        title: 'Dev',
        faviconUrl: '',
        service: { command: 'npm run dev', shell: 'auto' },
      },
    ];
    appConfigService.saveApps(dir, appsWithService);
    const loaded = appConfigService.loadApps(dir);

    expect(loaded).toEqual(appsWithService);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loadApps treats missing service field as 普通型 (向后兼容)', () => {
    const dir = `/tmp/web-nest-test-${Date.now()}`;
    fs.mkdirSync(dir, { recursive: true });
    // Legacy config: apps with no service field (pre-服务型 era)
    const legacyJson = JSON.stringify([
      { id: 'legacy', url: 'https://example.com', title: 'Legacy', faviconUrl: 'x.ico' },
    ]);
    fs.writeFileSync(path.join(dir, 'apps.config'), legacyJson, 'utf-8');

    const loaded = appConfigService.loadApps(dir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.service).toBeUndefined();

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('saveApps overwrites existing data', () => {
    const dir = `/tmp/web-nest-test-${Date.now()}`;
    fs.mkdirSync(dir, { recursive: true });

    appConfigService.saveApps(dir, mockApps);
    const updated = [
      { id: 'app-2', url: 'https://other.com', title: 'Other', faviconUrl: '' },
    ];
    appConfigService.saveApps(dir, updated);
    const loaded = appConfigService.loadApps(dir);

    expect(loaded).toEqual(updated);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loadApps returns empty array for corrupted JSON', () => {
    const dir = `/tmp/web-nest-test-${Date.now()}`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'apps.config'), '{invalid json', 'utf-8');

    const loaded = appConfigService.loadApps(dir);
    expect(loaded).toEqual([]);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
