import { describe, it, expect } from 'vitest';
import { createChannelPairMock } from '@/__tests__/infrastructure/helpers/channelHelpers';

async function mockRenderChannel() {
  const { rendererChannel } = await createChannelPairMock(
    (await import('@/shared/channel')).channel,
  );
  return rendererChannel;
}

describe('CounterService (Main)', () => {
  it('should increment count and call renderer updateCount via channel', async () => {
    const renderParams: number[] = [];
    const rendererChannel = await mockRenderChannel();
    const { counterService } = await import('@/main/services/counterService');
    rendererChannel.onRequest('CounterRendererApi:updateCount', (data) => {
      renderParams.push(...(data as number[]));
    });

    const result = await counterService.increment();

    expect(result.count).toBe(1);
    expect(renderParams).toEqual([1]);
  });

  it('should decrement count and call renderer updateCount via channel', async () => {
    const renderParams: number[] = [];
    const rendererChannel = await mockRenderChannel();
    const { counterService } = await import('@/main/services/counterService');
    rendererChannel.onRequest('CounterRendererApi:updateCount', (data) => {
      renderParams.push(...(data as number[]));
    });

    await counterService.increment();
    const result = await counterService.decrement();

    expect(result.count).toBe(0);
    expect(renderParams).toEqual([1, 0]);
  });

  it('should call updateCount with correct value after multiple operations', async () => {
    const renderParams: number[] = [];
    const rendererChannel = await mockRenderChannel();
    const { counterService } = await import('@/main/services/counterService');
    rendererChannel.onRequest('CounterRendererApi:updateCount', (data) => {
      renderParams.push(...(data as number[]));
    });

    await counterService.increment();
    await counterService.increment();
    await counterService.increment();

    expect(renderParams).toEqual([1, 2, 3]);
  });

  it('should handle channel errors gracefully', async () => {
    const rendererChannel = await mockRenderChannel();
    const { counterService } = await import('@/main/services/counterService');

    rendererChannel.onRequest('CounterRendererApi:updateCount', () => {
      throw new Error('Renderer error');
    });

    const result = await counterService.increment();
    
    expect(result.count).toBe(1);
  });
});
