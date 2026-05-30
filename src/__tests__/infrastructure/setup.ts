import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { createMockElectron } from './mocks/electron';

// Global electron mock — applied once at test start, shared by all tests
vi.mock('electron', () => createMockElectron());

// Run before every test — clears mocks and resets module state
beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
