import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { serviceRegistry } from '@/shared/serviceRegistry';
import { channel } from '@/shared/channel';
import { themeApi, i18nApi } from '@/shared/services';
import { applyThemeToRoot, defaultTheme } from '@/shared/theme';
import { initI18n, changeLocale } from './i18n';
import { DEFAULT_LOCALE, normalizeLocale } from '@/shared/i18n';

serviceRegistry.setDefaultChannel(channel);

async function main() {
  // Fetch locale and theme in parallel to reduce init latency
  const [localeResult, themeResult] = await Promise.allSettled([
    i18nApi.getLocale(),
    themeApi.getTheme(),
  ]);

  if (localeResult.status === 'fulfilled') {
    initI18n(localeResult.value);
  } else {
    initI18n(DEFAULT_LOCALE);
  }

  if (themeResult.status === 'fulfilled') {
    applyThemeToRoot(themeResult.value);
  } else {
    applyThemeToRoot(defaultTheme.tokens);
  }

  // Listen for locale changes pushed from main process
  channel.onRequest('locale-changed', (payload: unknown): true => {
    changeLocale(normalizeLocale(payload as string));
    return true;
  });

  // Add platform class for titlebar platform-specific styles
  if (window.electronEnv?.platform) {
    document.body.classList.add(`platform-${window.electronEnv.platform}`);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
}

main();
