import { describe, it, expect, vi } from 'vitest';

vi.mock('native', () => ({
  greet: vi.fn((name: string) => `Hello, ${name}!`),
}));

describe('nativeExample', () => {
  it('should return greeting message from native module', async () => {
    const { nativeExample } = await import('@/main/nativeExample');
    const result = nativeExample();
    expect(result).toBe('Hello, World!');
  });

  it('should call greet with "World"', async () => {
    const { greet } = await import('native');
    const { nativeExample } = await import('@/main/nativeExample');
    nativeExample();
    expect(greet).toHaveBeenCalledWith('World');
  });
});
