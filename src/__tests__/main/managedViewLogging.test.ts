import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChannelMock } from '@/__tests__/infrastructure/helpers/channelHelpers';

// Logger must be mocked before any module that consumes it is imported.
const { logMock } = vi.hoisted(() => {
  const logMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    log: vi.fn(),
    with: vi.fn(),
  };
  logMock.with.mockReturnValue(logMock);
  return { logMock };
});

vi.mock('@/shared/utils/log', () => ({
  logger: vi.fn(() => logMock),
  log: logMock,
  logManager: {
    initLog: vi.fn(() => Promise.resolve()),
    setGlobalContext: vi.fn(),
    mergeGlobalContext: vi.fn(),
  },
}));

type ManagedView = import('@/main/viewManager/managedView').ManagedView;
type Emit = (event: string, ...args: unknown[]) => void;

function emit(view: ManagedView, event: string, ...args: unknown[]): void {
  (view.webContents as unknown as { emit: Emit }).emit(event, ...args);
}

describe('ManagedView - load failure & renderer-crash logging', () => {
  let viewManager: import('@/main/viewManager').ViewManager;

  beforeEach(async () => {
    logMock.error.mockClear();
    // The webContents mock is a shared singleton; its event-handler map is custom state
    // that vi.clearAllMocks() does not reset, so handlers leak across tests. Clear them.
    const electron = await import('electron');
    (electron.webContents as unknown as { removeAllListeners: (event?: string) => void }).removeAllListeners();
    ({ viewManager } = await import('@/main/viewManager'));
  });

  async function createView(): Promise<ManagedView> {
    const { mainChannel } = await createChannelMock();
    vi.spyOn(mainChannel, 'init').mockResolvedValue();
    const viewId = await viewManager.createView({
      url: 'http://localhost:5173',
      channel: mainChannel as unknown as import('@/shared/channel').Channel,
      type: 'embedded',
    });
    return viewManager.getView(viewId)!;
  }

  it('logs did-fail-load at error level with viewId, url, errorCode and errorDescription', async () => {
    const view = await createView();

    emit(view, 'did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED', 'http://nope.invalid', true);

    expect(logMock.error).toHaveBeenCalledTimes(1);
    const [, payload] = logMock.error.mock.calls[0]!;
    expect(payload).toMatchObject({
      viewId: view.id,
      errorCode: -105,
      errorDescription: 'ERR_NAME_NOT_RESOLVED',
      validatedURL: 'http://nope.invalid',
    });
  });

  it('does not throw when did-fail-load fires on a destroyed webContents (guards getURL)', async () => {
    const view = await createView();
    const wc = view.webContents;

    // Simulate real Electron: a destroyed webContents throws on property access.
    const isDestroyedSpy = vi.spyOn(wc, 'isDestroyed').mockReturnValue(true);
    const getURLSpy = vi.spyOn(wc, 'getURL').mockImplementation(() => {
      throw new Error('webContents has been destroyed');
    });
    try {
      expect(() => emit(view, 'did-fail-load', {}, -3, 'ERR_ABORTED', 'http://u')).not.toThrow();

      expect(logMock.error).toHaveBeenCalledTimes(1);
      const [, payload] = logMock.error.mock.calls[0]!;
      expect(payload).toMatchObject({ viewId: view.id, url: '' });
    } finally {
      isDestroyedSpy.mockRestore();
      getURLSpy.mockRestore();
    }
  });

  it('logs render-process-gone at error level with viewId, reason and exitCode', async () => {
    const view = await createView();

    emit(view, 'render-process-gone', {}, { reason: 'crashed', exitCode: 11 });

    expect(logMock.error).toHaveBeenCalledTimes(1);
    const [, payload] = logMock.error.mock.calls[0]!;
    expect(payload).toMatchObject({
      viewId: view.id,
      reason: 'crashed',
      exitCode: 11,
    });
  });

  it('does not log did-finish-load as an error', async () => {
    const view = await createView();

    emit(view, 'did-finish-load');

    expect(logMock.error).not.toHaveBeenCalled();
  });

  it('unbinds handlers on destroy so later events neither log nor throw', async () => {
    const view = await createView();

    viewManager.destroyView(view.id);

    expect(() => emit(view, 'did-fail-load', {}, -3, 'x', 'http://u')).not.toThrow();
    expect(logMock.error).not.toHaveBeenCalled();
    expect(view.webContents.off).toHaveBeenCalled();
  });
});
