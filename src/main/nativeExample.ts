import { greet } from 'native';
import { logger } from '@/shared/utils/log';

export function nativeExample() {
  const message = greet('World');
  logger('native').info(message);
  return message;
}
