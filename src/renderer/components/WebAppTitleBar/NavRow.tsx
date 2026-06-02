import { ArrowLeft, ArrowRight, RefreshCw, Copy } from 'lucide-react';
import type { NavigationState } from '@/shared/services/webAppWindowApi';
import { webAppWindowApi } from '@/shared/services/webAppWindowApi';

interface NavRowProps {
  navState: NavigationState;
  onNavStateChange: (state: NavigationState) => void;
}

export function NavRow({ navState, onNavStateChange }: NavRowProps) {
  const handleBack = async () => {
    await webAppWindowApi.navigateBack();
    const state = await webAppWindowApi.getNavState();
    onNavStateChange(state);
  };

  const handleForward = async () => {
    await webAppWindowApi.navigateForward();
    const state = await webAppWindowApi.getNavState();
    onNavStateChange(state);
  };

  const handleReload = async () => {
    await webAppWindowApi.reload();
    const state = await webAppWindowApi.getNavState();
    onNavStateChange(state);
  };

  const handleCopy = async () => {
    await webAppWindowApi.copyUrl();
  };

  return (
    <div className="titlebar-row-2" data-testid="titlebar-row-2">
      <button
        className="titlebar-nav-btn"
        onClick={handleBack}
        disabled={!navState.canGoBack}
        title="后退"
        data-testid="nav-back"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button
        className="titlebar-nav-btn"
        onClick={handleForward}
        disabled={!navState.canGoForward}
        title="前进"
        data-testid="nav-forward"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        className="titlebar-nav-btn"
        onClick={handleReload}
        title="刷新"
        data-testid="nav-reload"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
      <span className="titlebar-url" data-testid="titlebar-url" title={navState.url}>
        {navState.url}
      </span>
      <button
        className="titlebar-nav-btn"
        onClick={handleCopy}
        title="复制 URL"
        data-testid="nav-copy"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}
