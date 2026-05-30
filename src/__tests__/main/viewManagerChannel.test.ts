import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createChannelMock } from '@/__tests__/infrastructure/helpers/channelHelpers';
import type { ChannelAPI } from '@/shared/channel';

async function createTestView(url: string): Promise<{ viewId: string; channel: ChannelAPI }> {
  const { mainChannel, rendererChannel } = await createChannelMock();

  const viewId = await (
    await import('@/main/viewManager')
  ).viewManager.createView({
    url,
    channel: mainChannel as unknown as import('@/shared/channel').Channel,
    type: 'embedded',
  });

  return { viewId, channel: rendererChannel };
}

describe('ViewManager - Channel Communication', () => {
  let viewManager: import('@/main/viewManager/index').ViewManager;

  beforeEach(async () => {
    viewManager = (await import('@/main/viewManager')).viewManager;
  });

  describe('requestTo', () => {
    it('should send request to specific view and receive response', async () => {
      const { viewId, channel } = await createTestView('http://localhost:5173');

      channel.onRequest('testMethod', () => 'testResponse');
      const result = await viewManager.requestTo(viewId, 'testMethod');

      expect(result).toBe('testResponse');
    });

    it('should throw error when view does not exist', async () => {
      await expect(viewManager.requestTo('nonexistent-id', 'testMethod')).rejects.toThrow(
        'View not found: nonexistent-id',
      );
    });

    it('should pass timeout parameter to channel request', async () => {
      const { viewId, channel } = await createTestView('http://localhost:5173');

      channel.onRequest('testMethod', () => 'response');
      const result = await viewManager.requestTo(viewId, 'testMethod', undefined, 5000);

      expect(result).toBe('response');
    });
  });

  describe('broadcast', () => {
    it('should send request to all views', async () => {
      const view1 = await createTestView('http://localhost:5173/view1');
      const view2 = await createTestView('http://localhost:5173/view2');

      const handler1 = vi.fn(() => 'result1');
      const handler2 = vi.fn(() => 'result2');
      view1.channel.onRequest('broadcastMethod', handler1);
      view2.channel.onRequest('broadcastMethod', handler2);

      await viewManager.broadcast('broadcastMethod');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should complete successfully even with empty views', async () => {
      await expect(viewManager.broadcast('testMethod')).resolves.toBeUndefined();
    });

    it('should handle partial failures gracefully', async () => {
      const view1 = await createTestView('http://localhost:5173/view1');
      const view2 = await createTestView('http://localhost:5173/view2');

      view1.channel.onRequest('failMethod', () => {
        throw new Error('Handler error');
      });
      view2.channel.onRequest('failMethod', () => 'success');

      await expect(viewManager.broadcast('failMethod')).resolves.toBeUndefined();
    });

    it('should pass timeout parameter to all channel requests', async () => {
      const view1 = await createTestView('http://localhost:5173/view1');
      const view2 = await createTestView('http://localhost:5173/view2');

      const handler1 = vi.fn(() => 'result1');
      const handler2 = vi.fn(() => 'result2');
      view1.channel.onRequest('timeoutMethod', handler1);
      view2.channel.onRequest('timeoutMethod', handler2);

      await viewManager.broadcast('timeoutMethod', undefined, 5000);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('onRequest', () => {
    it('should register handler for specific view', async () => {
      const { mainChannel, rendererChannel } = await createChannelMock();

      vi.spyOn(mainChannel, 'init').mockResolvedValue();

      const viewId = await viewManager.createView({
        url: 'http://localhost:5173',
        channel: mainChannel as unknown as import('@/shared/channel').Channel,
        type: 'embedded',
      });

      const handler = vi.fn(() => 'response');
      viewManager.onRequest(viewId, 'specificMethod', handler);

      const result = await rendererChannel.request('specificMethod');

      expect(handler).toHaveBeenCalled();
      expect(result).toBe('response');
    });

    it('should silently ignore handler for non-existent view', async () => {
      const handler = vi.fn();

      expect(() => {
        viewManager.onRequest('nonexistent-id', 'testMethod', handler);
      }).not.toThrow();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onAnyRequest', () => {
    it('should apply handler to all existing views', async () => {
      const view1 = await createTestView('http://localhost:5173/view1');
      const view2 = await createTestView('http://localhost:5173/view2');

      const capturedViewIds: string[] = [];
      const handler = (viewId: string) => {
        capturedViewIds.push(viewId);
        return `response-for-${viewId}`;
      };

      viewManager.onAnyRequest('anyMethod', handler);

      await view1.channel.request('anyMethod');
      await view2.channel.request('anyMethod');

      expect(capturedViewIds).toEqual([view1.viewId, view2.viewId]);
    });

    it('should apply handler to newly created views', async () => {
      const handler = vi.fn((viewId: string, _payload: unknown) => viewId);

      viewManager.onAnyRequest('newMethod', handler);

      const { viewId, channel } = await createTestView('http://localhost:5173');

      await channel.request('newMethod');

      expect(handler).toHaveBeenCalledWith(viewId, undefined);
    });

    it('should pass viewId to handler', async () => {
      const { viewId, channel } = await createTestView('http://localhost:5173');

      let capturedViewId: string | undefined;
      viewManager.onAnyRequest('captureMethod', (id) => {
        capturedViewId = id;
        return 'response';
      });

      await channel.request('captureMethod');

      expect(capturedViewId).toBe(viewId);
    });

    it('should allow multiple handlers for different methods', async () => {
      const view1 = await createTestView('http://localhost:5173/view1');
      const view2 = await createTestView('http://localhost:5173/view2');

      const handler1 = vi.fn(() => 'method1Response');
      const handler2 = vi.fn(() => 'method2Response');

      viewManager.onAnyRequest('method1', handler1);
      viewManager.onAnyRequest('method2', handler2);

      await view1.channel.request('method1');
      await view2.channel.request('method2');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('offAnyRequest', () => {
    it('should remove handler from all existing views', async () => {
      const view1 = await createTestView('http://localhost:5173/view1');
      const view2 = await createTestView('http://localhost:5173/view2');

      const capturedViewIds: string[] = [];
      const handler = (viewId: string) => {
        capturedViewIds.push(viewId);
        return 'response';
      };

      viewManager.onAnyRequest('removeMethod', handler);
      viewManager.offAnyRequest('removeMethod');

      await expect(view1.channel.request('removeMethod')).rejects.toThrow(
        'No handler for method: removeMethod',
      );
      await expect(view2.channel.request('removeMethod')).rejects.toThrow(
        'No handler for method: removeMethod',
      );

      expect(capturedViewIds).toEqual([]);
    });

    it('should remove specific method handler only', async () => {
      const view1 = await createTestView('http://localhost:5173/view1');
      const view2 = await createTestView('http://localhost:5173/view2');

      const handler1 = vi.fn(() => 'keep1');
      const handler2 = vi.fn(() => 'keep2');

      viewManager.onAnyRequest('keepMethod1', handler1);
      viewManager.onAnyRequest('removeMethod', handler2);
      viewManager.onAnyRequest('keepMethod2', handler2);

      viewManager.offAnyRequest('removeMethod');

      await view1.channel.request('keepMethod1');
      await view2.channel.request('keepMethod2');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should silently ignore removal of non-existent handler', async () => {
      expect(() => {
        viewManager.offAnyRequest('nonexistent-method');
      }).not.toThrow();
    });
  });

  describe('getAllChannels', () => {
    it('should return channels for all views', async () => {
      const { viewId: viewId1 } = await createTestView('http://localhost:5173/view1');
      const { viewId: viewId2 } = await createTestView('http://localhost:5173/view2');
      const { viewId: viewId3 } = await createTestView('http://localhost:5173/view3');

      const channels = viewManager.getAllChannels();

      expect(channels.size).toBe(3);
      expect(channels.has(viewId1)).toBe(true);
      expect(channels.has(viewId2)).toBe(true);
      expect(channels.has(viewId3)).toBe(true);
    });

    it('should return empty map when no views exist', async () => {
      const channels = viewManager.getAllChannels();

      expect(channels.size).toBe(0);
      expect(channels).toBeInstanceOf(Map);
    });
  });
});
