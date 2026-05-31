import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { serviceRegistry } from '@/shared/serviceRegistry';
import { channel } from '@/shared/channel';
import { themeApi } from '@/shared/services';
import { applyThemeToRoot, defaultTheme } from '@/shared/theme';

serviceRegistry.setDefaultChannel(channel);

async function main() {
  try {
    const tokens = await themeApi.getTheme();
    applyThemeToRoot(tokens);
  } catch {
    applyThemeToRoot(defaultTheme.tokens);
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
}

main();
