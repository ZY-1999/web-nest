import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export default async function globalSetup() {
  console.log('🔍 Verifying production build exists...')

  const mainEntryPath = resolve('dist/main/index.js')

  if (!existsSync(mainEntryPath)) {
    throw new Error('Production build not found. Run `pnpm run build` first.')
  }

  console.log('✅ Production build verified')
}
