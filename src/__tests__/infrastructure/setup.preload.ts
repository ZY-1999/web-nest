import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { createMockElectron } from './mocks/electron';

// Global electron mock for preload context
vi.mock('electron', () => createMockElectron());

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
