import { vi } from 'vitest';
import { createMockElectron, createMockMessageChannel } from '../mocks/electron';
import { serviceRegistry } from '@/shared/serviceRegistry';

/**
 * Creates a mock channel pair for testing Channel communication.
 * Directly sets ports without initialization for test isolation.
 *
 * @param options - kept for backwards compatibility, not used
 * @returns { mainChannel, rendererChannel } - a pair of Channel instances that can communicate
 */
export async function createChannelMock(_options: { webContentsId?: number } = {}): Promise<{
  mainChannel: import('@/shared/channel').Channel;
  rendererChannel: import('@/shared/channel').Channel;
}> {
  const { Channel } = await import('@/shared/channel');
  const { port1, port2 } = createMockMessageChannel();

  const mainChannel = new Channel();
  mainChannel.setPort(port1 as unknown as import('@/shared/channel/impl').Port);

  const rendererChannel = new Channel();
  rendererChannel.setPort(port2 as unknown as import('@/shared/channel/impl').Port);

  return { mainChannel, rendererChannel };
}

/**
 * 为现有的 channel 创建配对的 mock channel
 *
 * @param existingChannel - 现有的 channel 实例（如全局 channel 单例）
 * @returns 包含配置好的 channel 对的 Promise
 *
 * @example
 * ```typescript
 * const { mainChannel, rendererChannel } = await createChannelPairMock(channel);
 * // mainChannel 是传入的 channel，内部已调用 setPort(port1)
 * // rendererChannel 是新创建的 channel，内部已调用 setPort(port2)
 * // 两个 channel 通过 mock message ports 连接，可以相互通信
 * ```
 */
export async function createChannelPairMock(
  existingChannel: import('@/shared/channel').Channel,
): Promise<{
  mainChannel: import('@/shared/channel').Channel;
  rendererChannel: import('@/shared/channel').Channel;
}> {
  const { Channel } = await import('@/shared/channel');
  const { port1, port2 } = createMockMessageChannel();

  // 将 port1 设置到传入的现有 channel
  existingChannel.setPort(port1 as unknown as import('@/shared/channel/impl').Port);

  // 用 port2 创建新的 renderer channel
  const rendererChannel = new Channel();
  rendererChannel.setPort(port2 as unknown as import('@/shared/channel/impl').Port);

  return {
    mainChannel: existingChannel,
    rendererChannel,
  };
}

export async function createMainChannelMock() {
  process.env.PROCESS_TYPE = 'preload';
  vi.mock('electron', () => createMockElectron());

  const { mainChannel, rendererChannel } = await createChannelPairMock(
    (await import('@/shared/channel')).channel,
  );
  await rendererChannel.init();
  process.env.PROCESS_TYPE = 'renderer';
  serviceRegistry.setDefaultChannel((await import('@/shared/channel')).channel);
  return mainChannel;
}
