import { describe, it, expect, vi } from 'vitest';
import type { ManagedView } from '@/main/viewManager/managedView';

function makeFakeView(isDestroyedReturn: boolean): { view: ManagedView; toggleDevTools: ReturnType<typeof vi.fn> } {
  const toggleDevTools = vi.fn();
  const view = {
    webContents: { isDestroyed: vi.fn(() => isDestroyedReturn) },
    toggleDevTools,
  } as unknown as ManagedView;
  return { view, toggleDevTools };
}

function makeFakeViewForNav(opts: { url?: string; title?: string; canGoBack?: boolean; canGoForward?: boolean } = {}): ManagedView {
  return {
    webContents: {
      isDestroyed: () => false,
      getURL: () => opts.url ?? 'http://localhost:3000',
      getTitle: () => opts.title ?? 'App',
      navigationHistory: {
        canGoBack: () => opts.canGoBack ?? false,
        canGoForward: () => opts.canGoForward ?? false,
      },
    },
  } as unknown as ManagedView;
}

describe('WebAppWindowService - toggleDevTools', () => {
  it('delegates to the content view toggleDevTools when alive', async () => {
    const { view, toggleDevTools } = makeFakeView(false);
    const { WebAppWindowService } = await import('@/main/services/webAppWindowService');
    const service = new WebAppWindowService({ appId: 'app-1', contentView: view });

    await service.toggleDevTools();

    expect(view.webContents.isDestroyed).toHaveBeenCalled();
    expect(toggleDevTools).toHaveBeenCalledTimes(1);
  });

  it('skips and does not throw when the content view is destroyed', async () => {
    const { view, toggleDevTools } = makeFakeView(true);
    const { WebAppWindowService } = await import('@/main/services/webAppWindowService');
    const service = new WebAppWindowService({ appId: 'app-1', contentView: view });

    await expect(service.toggleDevTools()).resolves.toBeUndefined();
    expect(toggleDevTools).not.toHaveBeenCalled();
  });
});

describe('WebAppWindowService - buildNavState (Spec 06)', () => {
  it('buildNavState 透传 serviceState/serviceError（updateServiceState 后带上）', async () => {
    const view = makeFakeViewForNav();
    const { WebAppWindowService } = await import('@/main/services/webAppWindowService');
    const service = new WebAppWindowService({ appId: 'app-1', contentView: view });
    service.updateServiceState('running', 'ok');

    const nav = service.buildNavState();
    expect(nav.serviceState).toBe('running');
    expect(nav.serviceError).toBe('ok');
  });

  it('buildNavState 普通型无 serviceState（undefined，标题栏不渲染指示器）', async () => {
    const view = makeFakeViewForNav();
    const { WebAppWindowService } = await import('@/main/services/webAppWindowService');
    const service = new WebAppWindowService({ appId: 'app-1', contentView: view });

    const nav = service.buildNavState();
    expect(nav.serviceState).toBeUndefined();
  });
});
