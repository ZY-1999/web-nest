import React from 'react';
import { useFaviconStore } from '@/renderer/stores/faviconStore';

const sizeClasses = {
  sm: {
    container: 'h-4 w-4',
    img: 'h-4 w-4 rounded-sm',
    spinner: 'h-3 w-3',
    fallback: 'h-4 w-4 text-[10px]',
  },
  md: {
    container: 'h-6 w-6',
    img: 'h-6 w-6 rounded',
    spinner: 'h-4 w-4',
    fallback: 'h-6 w-6 text-xs',
  },
} as const;

interface FaviconImgProps {
  /** App ID mode — uses faviconStore for polling (catalog cards) */
  appId?: string;
  /** Direct data URL mode — renders immediately (titlebar) */
  faviconDataUrl?: string;
  /** Fallback text (e.g. app title) for first-letter display */
  fallback?: string;
  /** Icon size: 'sm' (16×16, titlebar) or 'md' (24×24, catalog). Default: 'md' */
  size?: 'sm' | 'md';
}

export function FaviconImg({ appId, faviconDataUrl, fallback, size = 'md' }: FaviconImgProps) {
  const cls = sizeClasses[size];

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
        className={cls.img}
        draggable={false}
        data-testid="favicon-image"
      />
    );
  }

  if (!appId) {
    // No data at all
    return <Fallback fallback={fallback} cls={cls} />;
  }

  // appId mode — check store state
  if (storeState?.status === 'loaded' && storeState.dataUrl) {
    return (
      <img
        src={storeState.dataUrl}
        alt=""
        className={cls.img}
        draggable={false}
        data-testid="favicon-image"
      />
    );
  }

  // Loading
  return <Spinner cls={cls} />;
}

function Spinner({ cls }: { cls: (typeof sizeClasses)[keyof typeof sizeClasses] }) {
  return (
    <div
      className={`${cls.container} flex items-center justify-center`}
      data-testid="favicon-spinner"
    >
      <div className={`${cls.spinner} animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground`} />
    </div>
  );
}

function Fallback({ fallback, cls }: { fallback?: string; cls: (typeof sizeClasses)[keyof typeof sizeClasses] }) {
  return (
    <span
      className={`${cls.fallback} flex items-center justify-center font-bold text-gray-500`}
      data-testid="favicon-fallback"
    >
      {fallback?.charAt(0).toUpperCase() ?? ''}
    </span>
  );
}
