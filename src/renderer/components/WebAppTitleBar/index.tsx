import { useEffect, useState } from 'react';
import { webAppWindowApi } from '@/shared/services/webAppWindowApi';
import { channel } from '@/shared/channel';
import type { NavigationState } from '@/shared/services/webAppWindowApi';
import { TitleRow } from './TitleRow';
import { NavRow } from './NavRow';

const defaultNavState: NavigationState = {
  url: '',
  title: '',
  faviconDataUrl: undefined,
  canGoBack: false,
  canGoForward: false,
};

export function WebAppTitleBar() {
  const [navState, setNavState] = useState<NavigationState>(defaultNavState);

  // Fetch initial state — retry until service is registered and content view has loaded
  useEffect(() => {
    let cancelled = false;

    const fetchState = async () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        if (cancelled) { return; }
        try {
          const state = await webAppWindowApi.getNavState();
          if (state.url) {
            setNavState(state);
            return;
          }
        } catch {
          // Service not registered yet — retry
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    };

    fetchState();
    return () => { cancelled = true; };
  }, []);

  // Listen for URL change pushes from main process
  useEffect(() => {
    const handler = (payload: unknown): true => {
      const state = payload as NavigationState;
      setNavState(state);
      return true;
    };
    channel.onRequest('url-changed', handler);
    return () => channel.offRequest('url-changed');
  }, []);

  return (
    <div className="webapp-titlebar" data-testid="webapp-titlebar">
      <TitleRow faviconDataUrl={navState.faviconDataUrl} title={navState.title} />
      <NavRow navState={navState} onNavStateChange={setNavState} />
    </div>
  );
}
