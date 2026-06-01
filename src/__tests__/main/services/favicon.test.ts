import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

const mockFetch = vi.fn();

vi.mock('electron', () => ({
  app: { getPath: (name: string) => `/tmp/web-nest-test-${process.pid}/${name}` },
  net: { fetch: mockFetch },
  ipcMain: { on: vi.fn(), handle: vi.fn(), off: vi.fn(), once: vi.fn(), removeHandler: vi.fn(), removeAllHandlers: vi.fn() },
}));

describe('faviconService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    const dir = `/tmp/web-nest-test-${process.pid}`;
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns empty string when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const { fetchFaviconDataUrl } = await import('@/main/services/faviconService');
    const result = await fetchFaviconDataUrl('https://fail.example.com/favicon.ico');
    expect(result).toBe('');
  });

  it('fetches and returns data URL', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name === 'content-type' ? 'image/png' : null },
      arrayBuffer: async () => pngBuffer.buffer,
    });

    const { fetchFaviconDataUrl } = await import('@/main/services/faviconService');
    const result = await fetchFaviconDataUrl('https://ok.example.com/favicon.ico');
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('caches result and reads from cache on second call', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => name === 'content-type' ? 'image/png' : null },
      arrayBuffer: async () => pngBuffer.buffer,
    });

    const { fetchFaviconDataUrl } = await import('@/main/services/faviconService');

    const result1 = await fetchFaviconDataUrl('https://cache.example.com/favicon.ico');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const result2 = await fetchFaviconDataUrl('https://cache.example.com/favicon.ico');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result1).toBe(result2);
  });

  it('returns empty string without fetching when url is empty', async () => {
    const { fetchFaviconDataUrl } = await import('@/main/services/faviconService');
    const result = await fetchFaviconDataUrl('');
    expect(result).toBe('');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty string when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { fetchFaviconDataUrl } = await import('@/main/services/faviconService');
    const result = await fetchFaviconDataUrl('https://error.example.com/favicon.ico');
    expect(result).toBe('');
  });
});
