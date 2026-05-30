import { channel } from '@/shared/channel';
import { logManager, log } from '@/shared/utils/log';

async function main() {
  await channel.init();
  await logManager.initLog();

  log.info('preload init');
}

main();
