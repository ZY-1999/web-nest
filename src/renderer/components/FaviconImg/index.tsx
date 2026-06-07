import React from 'react';
import { useFaviconStore } from '@/renderer/stores/faviconStore';

interface FaviconImgProps {
  /** App ID mode — uses faviconStore for polling (catalog cards) */
  appId?: string;
  /** Direct data URL mode — renders immediately (titlebar) */
  faviconDataUrl?: string;
  /** Fallback text (e.g. app title) for first-letter display */
  fallback?: string;
}

export function FaviconImg({ appId, faviconDataUrl, fallback }: FaviconImgProps) {
  // appId mode: use faviconStore
  const storeState = useFaviconStore(
    (s) => (appId ? s.favicons[appId] : undefined),
  );

  // Request favicon on mount in appId mode
  React.useEffect(() => {
    if (appId) {
      useFaviconStore.getState().requestFavicon(appId);
    }
  }, [appId]);

  // Determine what to render
  if (faviconDataUrl) {
    // Direct mode (titlebar)
    return (
      <img
        src={faviconDataUrl}
        alt=""
        className="h-4 w-4 rounded-sm"
        draggable={false}
        data-testid="favicon-image"
      />
    );
  }

  if (!appId) {
    // No data at all
    return <Fallback fallback={fallback} />;
  }

  // appId mode — check store state
  if (storeState?.status === 'loaded' && storeState.dataUrl) {
    return (
      <img
        src={storeState.dataUrl}
        alt=""
        className="h-6 w-6 rounded"
        data-testid="favicon-image"
      />
    );
  }

  // Loading
  return <Spinner />;
}

function Spinner() {
  return (
    <div
      className="h-6 w-6 flex items-center justify-center"
      data-testid="favicon-spinner"
    >
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
    </div>
  );
}

function Fallback({ fallback }: { fallback?: string }) {
  return (
    <span
      className="h-6 w-6 flex items-center justify-center text-xs font-bold text-gray-500"
      data-testid="favicon-fallback"
    >
      {fallback?.charAt(0).toUpperCase() ?? ''}
    </span>
  );
}
