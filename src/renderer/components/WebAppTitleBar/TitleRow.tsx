import { useTranslation } from 'react-i18next';
import { Terminal } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import { Button } from '@/renderer/components/ui/button';
import { FaviconImg } from '@/renderer/components/FaviconImg';
import { webAppWindowApi } from '@/shared/services/webAppWindowApi';

interface TitleRowProps {
  appId?: string;
  title: string;
}

export function TitleRow({ appId, title }: TitleRowProps) {
  const { t } = useTranslation();

  const handleToggleDevTools = () => {
    void webAppWindowApi.toggleDevTools();
  };

  return (
    <div className="titlebar-row-1" data-testid="titlebar-row-1">
      <div className="titlebar-row-1-left">
        <FaviconImg appId={appId} fallback={title} size="sm" />
      </div>
      <div className="titlebar-row-1-center" data-testid="titlebar-title">
        {title}
      </div>
      <div className="titlebar-row-1-right">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleDevTools}
          className="h-7 w-7 outline-none focus-visible:ring-0"
          aria-label={t('titlebar.devtools')}
          title={t('titlebar.devtools')}
          data-testid="titlebar-devtools"
        >
          <Terminal className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </div>
  );
}
