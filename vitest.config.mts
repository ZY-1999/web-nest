import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { sourceFilePlugin } from './src/vitePlugins/sourceFilePlugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const alias = { '@': path.resolve(__dirname, 'src') };

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    exclude: ['node_modules', 'dist', 'release'],
    projects: [
      {
        plugins: [sourceFilePlugin()],
        resolve: { alias },
        test: {
          name: 'main',
          setupFiles: ['src/__tests__/infrastructure/setup.ts'],
          include: [
            'src/__tests__/main/**',
            'src/__tests__/integration/**',
            'src/__tests__/shared/**',
          ],
          exclude: ['src/__tests__/renderer/**', 'src/__tests__/preload/**'],
          environment: 'node',
          env: { PROCESS_TYPE: 'main' },
        },
      },
      {
        plugins: [sourceFilePlugin()],
        resolve: { alias },
        test: {
          name: 'preload',
          setupFiles: ['src/__tests__/infrastructure/setup.preload.ts'],
          include: ['src/__tests__/preload/**'],
          environment: 'jsdom',
          env: { PROCESS_TYPE: 'preload' },
        },
      },
      {
        plugins: [sourceFilePlugin()],
        resolve: { alias },
        test: {
          name: 'renderer',
          globals: true,
          setupFiles: ['src/__tests__/infrastructure/setup.renderer.ts'],
          include: ['src/__tests__/renderer/**'],
          environment: 'jsdom',
          env: { PROCESS_TYPE: 'renderer' },
        },
      },
    ],
  },
});
