import { ThemeToggle } from '../ThemeToggle';
import { FaviconImg } from '@/renderer/components/FaviconImg';

interface TitleRowProps {
  appId?: string;
  title: string;
}

export function TitleRow({ appId, title }: TitleRowProps) {
  return (
    <div className="titlebar-row-1" data-testid="titlebar-row-1">
      <div className="titlebar-row-1-left">
        <FaviconImg appId={appId} fallback={title} size="sm" />
      </div>
      <div className="titlebar-row-1-center" data-testid="titlebar-title">
        {title}
      </div>
      <div className="titlebar-row-1-right">
        <ThemeToggle />
      </div>
    </div>
  );
}
