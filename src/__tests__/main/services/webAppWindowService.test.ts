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
