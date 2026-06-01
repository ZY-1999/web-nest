import { channel } from '@/shared/channel';
import { parsePreloadArgs } from '@/shared/preload/args';
import { logManager, log } from '@/shared/utils/log';

async function main() {
  const { channelTimeout, channelExpose } = parsePreloadArgs(process.argv);
  await channel.init({ defaultTimeout: channelTimeout, expose: channelExpose });
  await logManager.initLog();

  log.info('preload init');
}

main();
