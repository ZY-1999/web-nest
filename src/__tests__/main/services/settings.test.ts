import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_SETTINGS, type AppSettings } from '@/shared/settings';

// Use a temp directory for test config
const TEST_CONFIG_DIR = path.join(__dirname, '__test_settings_tmp__');
const SETTINGS_FILE = path.join(TEST_CONFIG_DIR, 'settings.json');

// Mock paths to use temp directory
vi.mock('@/main/utils/paths', () => ({
  paths: {
    getConfigDir: () => TEST_CONFIG_DIR,
  },
}));

describe('SettingsService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let settingsService: any;

  beforeEach(async () => {
    // Clean temp dir
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
    }

    vi.resetModules();
    const mod = await import('@/main/services/settingsService');
    settingsService = mod.settingsService;
  });

  afterEach(() => {
    try {
      if (fs.existsSync(SETTINGS_FILE)) { fs.unlinkSync(SETTINGS_FILE); }
      fs.rmdirSync(TEST_CONFIG_DIR);
    } catch { /* ignore cleanup errors */ }
  });

  it('returns defaults when no config file exists', async () => {
    settingsService.init();
    const settings = await settingsService.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('persists settings to JSON file', async () => {
    settingsService.init();
    await settingsService.setSettings({ theme: 'dark' });

    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.theme).toBe('dark');
    expect(parsed.autoLaunch).toBe(false);
  });

  it('loads persisted settings on init', async () => {
    const custom: AppSettings = { ...DEFAULT_SETTINGS, theme: 'dark', locale: 'en' };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(custom, null, 2), 'utf-8');

    settingsService.init();
    const settings = await settingsService.getSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.locale).toBe('en');
  });

  it('merges partial update without losing other fields', async () => {
    settingsService.init();
    await settingsService.setSettings({ theme: 'dark' });
    await settingsService.setSettings({ autoLaunch: true });

    const settings = await settingsService.getSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.autoLaunch).toBe(true);
  });

  it('falls back to defaults when file is corrupted', async () => {
    fs.writeFileSync(SETTINGS_FILE, '{ invalid json', 'utf-8');
    settingsService.init();
    const settings = await settingsService.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('merges with defaults for partial config files', async () => {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ theme: 'dark' }), 'utf-8');
    settingsService.init();
    const settings = await settingsService.getSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.autoLaunch).toBe(false);
    expect(settings.proxyMode).toBe('none');
  });

  it('returns copy from getSettings (not reference)', async () => {
    settingsService.init();
    const s1 = await settingsService.getSettings();
    const s2 = await settingsService.getSettings();
    expect(s1).toEqual(s2);
    expect(s1).not.toBe(s2);
  });

  describe('getProxyUrl', () => {
    it('returns undefined when proxy is none', () => {
      settingsService.init();
      expect(settingsService.getProxyUrl()).toBeUndefined();
    });

    it('returns undefined when host or port is empty', async () => {
      settingsService.init();
      await settingsService.setSettings({ proxyMode: 'http', proxyHost: '', proxyPort: 8080 });
      expect(settingsService.getProxyUrl()).toBeUndefined();
    });

    it('builds http proxy url', async () => {
      settingsService.init();
      await settingsService.setSettings({ proxyMode: 'http', proxyHost: '127.0.0.1', proxyPort: 8080 });
      expect(settingsService.getProxyUrl()).toBe('http://127.0.0.1:8080');
    });

    it('builds socks5 proxy url', async () => {
      settingsService.init();
      await settingsService.setSettings({ proxyMode: 'socks5', proxyHost: '127.0.0.1', proxyPort: 1080 });
      expect(settingsService.getProxyUrl()).toBe('socks5://127.0.0.1:1080');
    });
  });
});
