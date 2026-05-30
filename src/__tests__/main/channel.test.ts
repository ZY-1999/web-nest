import { describe, expect, it, vi } from 'vitest';
import { createChannelMock } from '@/__tests__/infrastructure/helpers/channelHelpers';

describe('Channel', () => {
  describe('request', () => {
    it('should reject when port not initialized', async () => {
      const { Channel } = await import('@/shared/channel');
      const ch = new Channel();
      await expect(ch.request('test')).rejects.toThrow('Channel port not initialized');
    });
  });

  describe('init', () => {
    it('should throw when webContentsId is missing', async () => {
      const { Channel } = await import('@/shared/channel');
      const ch = new Channel();
      await expect(ch.init({ webContentsId: undefined as unknown as number })).rejects.toThrow(
        'webContentsId is required',
      );
    });
  });

  describe('request / onRequest / offRequest', () => {
    it('should resolve with handler result', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest('test', () => 'expected_result');
      await expect(mainChannel.request('test', { data: 'test' })).resolves.toBe('expected_result');
    });

    it('should reject when no handler registered', async () => {
      const { mainChannel } = await createChannelMock({ webContentsId: 1 });
      await expect(mainChannel.request('nonexistent')).rejects.toThrow(
        'No handler for method: nonexistent',
      );
    });

    it('should not call handler after offRequest', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      const handler = vi.fn().mockResolvedValue('result');
      rendererChannel.onRequest('toRemove', handler);
      rendererChannel.offRequest('toRemove');
      await expect(mainChannel.request('toRemove')).rejects.toThrow(
        'No handler for method: toRemove',
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it('should resolve before timeout', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest('test', () => 'result');
      await expect(mainChannel.request('test', undefined, 1000)).resolves.toBe('result');
    });

    it('should reject after timeout', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest(
        'slow',
        () => new Promise((resolve) => setTimeout(() => resolve('result'), 200)),
      );
      await expect(mainChannel.request('slow', undefined, 50)).rejects.toThrow(
        'Request timeout: slow',
      );
    });

    it('should reject with ChannelTimeoutError', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest(
        'test',
        () => new Promise((resolve) => setTimeout(() => resolve('result'), 200)),
      );
      await expect(mainChannel.request('test', undefined, 50)).rejects.toBeInstanceOf(
        (await import('@/shared/channel')).ChannelTimeoutError,
      );
    });

    it('should resolve when handler returns a promise', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest('asyncMethod', () => Promise.resolve('async_result'));
      await expect(mainChannel.request('asyncMethod')).resolves.toBe('async_result');
    });

    it('should reject when handler throws an error', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest('errorMethod', () => {
        throw new Error('Handler error');
      });
      await expect(mainChannel.request('errorMethod')).rejects.toThrow('Handler error');
    });

    it('should reject when handler returns a rejected promise', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest('asyncErrorMethod', () => Promise.reject(new Error('Async error')));
      await expect(mainChannel.request('asyncErrorMethod')).rejects.toThrow('Async error');
    });
  });

  describe('destroy', () => {
    it('should reject after destroy', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest('test', vi.fn().mockResolvedValue('result'));
      const promise = mainChannel.request('test');
      mainChannel.destroy();
      await expect(promise).rejects.toThrow('Channel destroyed');
    });

    it('should clear pending timeouts', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock({ webContentsId: 1 });
      rendererChannel.onRequest('test', vi.fn().mockResolvedValue('result'));
      const promise = mainChannel.request('test', undefined, 1000);
      mainChannel.destroy();
      await expect(promise).rejects.toThrow('Channel destroyed');
    });
  });

  describe('ChannelTimeoutError', () => {
    it('should have correct name and message', async () => {
      const { ChannelTimeoutError } = await import('@/shared/channel');
      const err = new ChannelTimeoutError('testMethod');
      expect(err.name).toBe('ChannelTimeoutError');
      expect(err.message).toBe('Request timeout: testMethod');
      expect(err.method).toBe('testMethod');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ChannelTimeoutError);
    });
  });
});
