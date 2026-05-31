import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/renderer/components/ui/button';
import { themeApi } from '@/shared/services/themeApi';
import { applyThemeToRoot } from '@/shared/theme';
import type { ThemeMode } from '@/shared/theme';

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('light');

  const toggle = async () => {
    const next: ThemeMode = mode === 'light' ? 'dark' : 'light';
    const tokens = await themeApi.setTheme(next);
    applyThemeToRoot(tokens);
    setMode(next);
  };

  useEffect(() => {
    themeApi.getThemeMode().then((res) => setMode(res));
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="fixed right-4 top-4 z-50"
      aria-label="Toggle theme"
      data-testid="theme-toggle"
    >
      {mode === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
