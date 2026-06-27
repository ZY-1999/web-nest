/** Global application settings persisted to ~/.web-nest/settings.json */
export interface AppSettings {
  /** Theme mode: 'light' or 'dark' */
  theme: 'light' | 'dark';
  /** Locale string, e.g. 'zh-CN', 'en' */
  locale: string;
  /** Launch app on system startup */
  autoLaunch: boolean;
  /** Disable GPU hardware acceleration (requires restart) */
  disableGpu: boolean;
  /** Enable debug mode: log all levels to a separate debug.log (requires restart) */
  debugMode: boolean;
  /** Proxy type */
  proxyMode: 'none' | 'http' | 'socks5';
  /** Proxy server hostname */
  proxyHost: string;
  /** Proxy server port */
  proxyPort: number;
  /** Custom User-Agent string (empty = use default) */
  userAgent: string;
}

/** Partial settings for patch updates */
export type SettingsPatch = Partial<AppSettings>;

/** Default settings applied when no config file exists */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  locale: '',
  autoLaunch: false,
  disableGpu: false,
  debugMode: false,
  proxyMode: 'none',
  proxyHost: '',
  proxyPort: 0,
  userAgent: '',
};
