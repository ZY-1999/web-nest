import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { Button } from '@/renderer/components/ui/button';
import { ThemeToggle } from '../ThemeToggle';
import { SettingsDialog } from '../SettingsDialog';

export function TitleBar() {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <div className="app-titlebar">
        <div className="titlebar-left">
          <img src="./icon.png" alt="" className="ml-2 h-5 w-5" draggable={false} />
        </div>
        <div className="titlebar-center">{t('titlebar.appName')}</div>
        <div className="titlebar-right flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className="h-7 w-7 outline-none focus-visible:ring-0"
            aria-label={t('titlebar.openSettings')}
            data-testid="open-settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
