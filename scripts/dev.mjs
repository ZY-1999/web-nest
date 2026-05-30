#!/usr/bin/env node
import { spawn } from 'node:child_process';

const projectDir = process.cwd();
const NODE_ENV = 'development';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: projectDir,
      ...options,
    });
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`Command failed with code ${code}`));
      else resolve();
    });
  });
}

async function main() {
  console.log('🚀 Starting development environment...\n');

  // Build main and preload (excluding renderer)
  await run('node', ['scripts/build.mjs', 'main', 'preload'], {
    env: { ...process.env, NODE_ENV },
  });

  console.log('\n✅ Build complete. Starting dev server and Electron...\n');

  // Start Vite renderer server and Electron concurrently
  await run('concurrently', [
    '-k',
    '"vite --config vite.config.renderer.mts"',
    '"wait-on http://localhost:5173 && cross-env NODE_ENV=development electron ."',
  ]);
}

main().catch((err) => {
  console.error('Failed to start dev environment:', err.message);
  process.exit(1);
});
