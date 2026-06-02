import { ThemeToggle } from '../ThemeToggle';

interface TitleRowProps {
  faviconDataUrl?: string;
  title: string;
}

export function TitleRow({ faviconDataUrl, title }: TitleRowProps) {
  return (
    <div className="titlebar-row-1" data-testid="titlebar-row-1">
      <div className="titlebar-row-1-left">
        {faviconDataUrl ? (
          <img src={faviconDataUrl} alt="" className="h-4 w-4 rounded-sm" draggable={false} />
        ) : (
          <div className="h-4 w-4 rounded-sm bg-muted" />
        )}
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
