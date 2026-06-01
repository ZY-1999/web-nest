/**
 * Preload additionalArguments key constants.
 * Central registry for all preload argument keys — extend here for future params.
 */
export const PRELOAD_ARGS = {
  CHANNEL_TIMEOUT: 'channel-timeout',
  CHANNEL_EXPOSE: 'channel-expose',
} as const;

export interface PreloadOptions {
  channelTimeout?: number;
  channelExpose?: boolean;
}

/**
 * Main process: build preload additionalArguments from options.
 *
 * @example
 * buildPreloadArgs({ defaultTimeout: 5000, expose: false })
 * // → ['--channel-timeout=5000', '--channel-expose=false']
 */
export function buildPreloadArgs(options: PreloadOptions): string[] {
  const args: string[] = [];
  if (options.channelTimeout !== undefined) {
    args.push(`--${PRELOAD_ARGS.CHANNEL_TIMEOUT}=${options.channelTimeout}`);
  }
  if (options.channelExpose !== undefined) {
    args.push(`--${PRELOAD_ARGS.CHANNEL_EXPOSE}=${options.channelExpose}`);
  }
  return args;
}

/**
 * Preload: parse preload additionalArguments from argv.
 *
 * @example
 * parsePreloadArgs(['--channel-timeout=5000', '--channel-expose=false'])
 * // → { defaultTimeout: 5000, expose: false }
 */
export function parsePreloadArgs(argv: string[]): PreloadOptions {
  const result: PreloadOptions = {};

  const timeoutArg = argv.find((a) => a.startsWith(`--${PRELOAD_ARGS.CHANNEL_TIMEOUT}=`));
  if (timeoutArg) {
    const value = Number(timeoutArg.split('=')[1]);
    if (!Number.isNaN(value)) {
      result.channelTimeout = value;
    }
  }

  const exposeArg = argv.find((a) => a.startsWith(`--${PRELOAD_ARGS.CHANNEL_EXPOSE}=`));
  if (exposeArg) {
    const value = exposeArg.split('=')[1];
    result.channelExpose = value === 'true';
  }

  return result;
}
