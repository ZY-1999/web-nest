import { contextBridge } from 'electron';
import { channel } from '@/shared/channel';
import { parsePreloadArgs } from '@/shared/preload/args';
import { logManager, log } from '@/shared/utils/log';

// Expose platform info to renderer via contextBridge (separate namespace from channel)
contextBridge.exposeInMainWorld('electronEnv', {
  platform: process.platform,
});

async function main() {
  const { channelTimeout, channelExpose } = parsePreloadArgs(process.argv);
  await channel.init({ defaultTimeout: channelTimeout, expose: channelExpose });
  await logManager.initLog();

  log.info('preload init');
}

main();
