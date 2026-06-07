import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../ThemeToggle';

export function TitleBar() {
  const { t } = useTranslation();
  return (
    <div className="app-titlebar">
      <div className="titlebar-left">
        <img src="./icon.png" alt="" className="ml-2 h-5 w-5" draggable={false} />
      </div>
      <div className="titlebar-center">{t('titlebar.appName')}</div>
      <div className="titlebar-right">
        <ThemeToggle />
      </div>
    </div>
  );
}
