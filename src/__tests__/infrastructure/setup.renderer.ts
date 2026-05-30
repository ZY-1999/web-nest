import { vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Renderer test setup — jsdom provides window/document/navigator

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
// Initialize log and channel mocks, then expose to window

// ─── Mock window.__app_log__ ──────────────────────────────────────────────────
(globalThis as Record<string, unknown>).__app_log__ = {
  sendLog: vi.fn((_level: string, _ctx: Record<string, unknown>, _serializedParams: string[]) => {
    // Default mock implementation - tests can override via spy
  }),
};
