import { describe, expect, it } from 'vitest';
import { buildPreloadArgs, parsePreloadArgs, PRELOAD_ARGS } from '@/shared/preload/args';

describe('PRELOAD_ARGS', () => {
  it('should have correct key values', () => {
    expect(PRELOAD_ARGS.CHANNEL_TIMEOUT).toBe('channel-timeout');
    expect(PRELOAD_ARGS.CHANNEL_EXPOSE).toBe('channel-expose');
  });
});

describe('buildPreloadArgs', () => {
  it('should build args with channelTimeout', () => {
    expect(buildPreloadArgs({ channelTimeout: 5000 })).toEqual([
      `--${PRELOAD_ARGS.CHANNEL_TIMEOUT}=5000`,
    ]);
  });

  it('should build args with channelExpose', () => {
    expect(buildPreloadArgs({ channelExpose: false })).toEqual([
      `--${PRELOAD_ARGS.CHANNEL_EXPOSE}=false`,
    ]);
    expect(buildPreloadArgs({ channelExpose: true })).toEqual([
      `--${PRELOAD_ARGS.CHANNEL_EXPOSE}=true`,
    ]);
  });

  it('should build args with both options', () => {
    expect(buildPreloadArgs({ channelTimeout: 3000, channelExpose: false })).toEqual([
      `--${PRELOAD_ARGS.CHANNEL_TIMEOUT}=3000`,
      `--${PRELOAD_ARGS.CHANNEL_EXPOSE}=false`,
    ]);
  });

  it('should return empty array when no options provided', () => {
    expect(buildPreloadArgs({})).toEqual([]);
  });
});

describe('parsePreloadArgs', () => {
  it('should parse channelTimeout and channelExpose from argv', () => {
    const result = parsePreloadArgs([
      '/path/to/electron',
      `--${PRELOAD_ARGS.CHANNEL_TIMEOUT}=5000`,
      `--${PRELOAD_ARGS.CHANNEL_EXPOSE}=false`,
    ]);
    expect(result).toEqual({ channelTimeout: 5000, channelExpose: false });
  });

  it('should parse only channelTimeout', () => {
    const result = parsePreloadArgs([`--${PRELOAD_ARGS.CHANNEL_TIMEOUT}=3000`]);
    expect(result).toEqual({ channelTimeout: 3000 });
  });

  it('should parse only channelExpose', () => {
    const result = parsePreloadArgs([`--${PRELOAD_ARGS.CHANNEL_EXPOSE}=true`]);
    expect(result).toEqual({ channelExpose: true });
  });

  it('should return empty object when no matching args', () => {
    const result = parsePreloadArgs(['/path/to/electron']);
    expect(result).toEqual({});
  });

  it('should ignore invalid channelTimeout value', () => {
    const result = parsePreloadArgs([`--${PRELOAD_ARGS.CHANNEL_TIMEOUT}=abc`]);
    expect(result).toEqual({});
  });

  it('should treat channelExpose value as boolean (only "true" is true)', () => {
    expect(parsePreloadArgs([`--${PRELOAD_ARGS.CHANNEL_EXPOSE}=true`]).channelExpose).toBe(true);
    expect(parsePreloadArgs([`--${PRELOAD_ARGS.CHANNEL_EXPOSE}=false`]).channelExpose).toBe(false);
    expect(parsePreloadArgs([`--${PRELOAD_ARGS.CHANNEL_EXPOSE}=other`]).channelExpose).toBe(false);
  });
});

describe('buildPreloadArgs → parsePreloadArgs round-trip', () => {
  it('should be symmetric for full options', () => {
    const original = { channelTimeout: 5000, channelExpose: false };
    const result = parsePreloadArgs(buildPreloadArgs(original));
    expect(result).toEqual(original);
  });

  it('should be symmetric for partial options', () => {
    const original = { channelTimeout: 3000 };
    const result = parsePreloadArgs(buildPreloadArgs(original));
    expect(result).toEqual(original);
  });
});
