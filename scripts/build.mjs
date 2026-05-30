#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { rmSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE_ENV = process.env.NODE_ENV || 'development';

const configs = [
  { name: 'main', config: 'vite.config.main.mts', env: {} },
  { name: 'preload', config: 'vite.config.preload.mts', env: {} },
  { name: 'renderer', config: 'vite.config.renderer.mts', env: {} },
];

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

async function clean() {
  console.log('Cleaning dist...');
  try {
    const distPath = path.join(projectDir, 'dist');
    if (existsSync(distPath)) {
      const items = readdirSync(distPath, { withFileTypes: true });
      for (const item of items) {
        if (item.name !== 'types') {
          const itemPath = path.join(distPath, item.name);
          rmSync(itemPath, { recursive: true, force: true });
        }
      }
    }
    console.log('Clean complete (preserving dist/types)');
  } catch (error) {
    console.log('Clean error (non-fatal):', error.message);
  }
}

async function build({ name, config, env }) {
  console.log(`\nBuilding ${name}...`);
  await run('vite', ['build', '--config', config], { env: { NODE_ENV, ...process.env, ...env } });
  console.log(`${name} built successfully`);
}

async function main() {
  const startTime = Date.now();
  const buildTargets = process.argv.slice(2);

  let configsToBuild = configs;

  if (buildTargets.length > 0) {
    configsToBuild = configs.filter((c) => buildTargets.includes(c.name));

    if (configsToBuild.length === 0) {
      console.error(`❌ Unknown build targets: ${buildTargets.join(', ')}`);
      console.error(`Available targets: ${configs.map((c) => c.name).join(', ')}`);
      process.exit(1);
    }

    console.log(`Building: ${configsToBuild.map((c) => c.name).join(', ')}`);
  } else {
    configsToBuild = configs;
  }

  await clean();

  for (const config of configsToBuild) {
    await build(config);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nBuild complete in ${duration}s`);
}

main().catch((err) => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
