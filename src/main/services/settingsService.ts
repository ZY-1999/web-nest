import fs from 'fs';
import path from 'path';
import { app, session } from 'electron';
import { SettingsApi } from '@/shared/services/settingsApi';
import { DEFAULT_SETTINGS, type AppSettings, type SettingsPatch } from '@/shared/settings';
import { Singleton } from '@/shared/utils/singleton';
import { logger } from '@/shared/utils/log';
import { paths } from '@/main/utils/paths';

const log = logger(__SOURCE_FILE__);

const SETTINGS_FILE = 'settings.json';

@Singleton()
class SettingsService extends SettingsApi {
  private cache: AppSettings = { ...DEFAULT_SETTINGS };

  /** Initialize settings from disk. Call once at startup before any service reads config. */
  init(): void {
    this.cache = this.load();
    log.info('Settings loaded');
  }

  async getSettings(): Promise<AppSettings> {
    return { ...this.cache };
  }

  /** Synchronous access for startup code that can't use async. */
  getSettingsSync(): AppSettings {
    return { ...this.cache };
  }

  async setSettings(patch: SettingsPatch): Promise<AppSettings> {
    return this.setSettingsSync(patch);
  }

  /** Synchronous update for startup code that can't use async. */
  setSettingsSync(patch: SettingsPatch): AppSettings {
    this.cache = { ...this.cache, ...patch };
    this.save();
    log.info('Settings updated:', Object.keys(patch).join(', '));
    this.applyRuntimeEffects();
    return { ...this.cache };
  }

  /** Build a proxy URL from current proxy settings. Returns undefined if proxy is disabled. */
  getProxyUrl(): string | undefined {
    if (this.cache.proxyMode === 'none' || !this.cache.proxyHost || !this.cache.proxyPort) {
      return undefined;
    }
    const scheme = this.cache.proxyMode === 'socks5' ? 'socks5' : 'http';
    return `${scheme}://${this.cache.proxyHost}:${this.cache.proxyPort}`;
  }

  /**
   * Apply proxy config to a specific session (e.g. per-app partition).
   * Called when creating a new web app view.
   */
  async applyProxyToSession(ses: Electron.Session): Promise<void> {
    try {
      const config = this.buildProxyConfig();
      await ses.setProxy(config);
      log.debug('Proxy applied to session');
    } catch (error) {
      log.warn('Failed to apply proxy to session:', error);
    }
  }

  /**
   * Apply runtime settings effects (autoLaunch, userAgent, proxy).
   * Called after init() when app is ready, and after each setSettings().
   * GPU disable is handled separately in index.ts (must run before whenReady).
   */
  applyRuntimeEffects(): void {
    this.applyAutoLaunch();
    this.applyUserAgent();
    this.applyProxy();
  }

  private applyAutoLaunch(): void {
    try {
      app.setLoginItemSettings({ openAtLogin: this.cache.autoLaunch });
      log.debug('Auto-launch set to:', this.cache.autoLaunch);
    } catch (error) {
      log.warn('Failed to set auto-launch:', error);
    }
  }

  private applyUserAgent(): void {
    const ua = this.cache.userAgent;
    if (ua) {
      try {
        session.defaultSession.setUserAgent(ua);
        log.debug('User-Agent set to:', ua);
      } catch (error) {
        log.warn('Failed to set user-agent:', error);
      }
    }
  }

  /**
   * Three-layer proxy coverage:
   * 1. session.defaultSession — electron.net.fetch, main window
   * 2. process.env — Node.js fetch / http / https
   * 3. Per-app sessions are handled via applyProxyToSession() at view creation time
   */
  private applyProxy(): void {
    const proxyUrl = this.getProxyUrl();

    // Layer 1: Electron session proxy
    try {
      const config = this.buildProxyConfig();
      session.defaultSession.setProxy(config).catch((err) => {
        log.warn('Failed to set default session proxy:', err);
      });
    } catch (error) {
      log.warn('Failed to apply session proxy:', error);
    }

    // Layer 2: Node.js env vars
    if (proxyUrl) {
      process.env.HTTP_PROXY = proxyUrl;
      process.env.HTTPS_PROXY = proxyUrl;
      process.env.ALL_PROXY = proxyUrl;
      log.info('Proxy env vars set:', proxyUrl);
    } else {
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
      delete process.env.ALL_PROXY;
      log.debug('Proxy env vars cleared');
    }
  }

  /** Build Electron ProxyConfig from current settings. */
  private buildProxyConfig(): Electron.ProxyConfig {
    if (this.cache.proxyMode === 'none' || !this.cache.proxyHost || !this.cache.proxyPort) {
      return { mode: 'direct' };
    }

    const addr = `${this.cache.proxyHost}:${this.cache.proxyPort}`;
    if (this.cache.proxyMode === 'socks5') {
      return { mode: 'fixed_servers', proxyRules: `socks=${addr}` };
    }
    // HTTP proxy covers both http and https
    return { mode: 'fixed_servers', proxyRules: `http=${addr};https=${addr}` };
  }

  private load(): AppSettings {
    const filePath = path.join(paths.getConfigDir(), SETTINGS_FILE);
    if (!fs.existsSync(filePath)) {
      return { ...DEFAULT_SETTINGS };
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      // Merge with defaults to handle missing keys from older versions
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (error) {
      log.warn('Failed to parse settings file, using defaults:', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  private save(): void {
    const configDir = paths.getConfigDir();
    const filePath = path.join(configDir, SETTINGS_FILE);
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      log.error('Failed to save settings:', error);
    }
  }
}

export const settingsService = new SettingsService();
