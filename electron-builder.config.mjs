export default {
  appId: 'com.rika1999.webnest',
  productName: 'web-nest',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  icon: 'build/icons/app/icon.png',
  asar: false,
  files: [
    'dist/**/*',
    'package.json',
    '!node_modules/**',
    'node_modules/native/index.cjs',
    'node_modules/native/*.node',
  ],
  extraMetadata: {
    main: 'dist/main/index.js',
  },
  extraResources: [
    {
      from: 'build/icons/tray',
      to: 'icons/tray',
    },
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    artifactName: '${productName}-${version}-${arch}.${ext}',
    icon: 'build/icons/app/icon.ico',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
  },
  mac: {
    // Reserved - no signing/notarization in v1
    target: [
      {
        target: 'zip',
        arch: ['arm64'],
      },
    ],
    category: 'public.app-category.productivity',
    artifactName: '${productName}-${version}-${arch}.${ext}',
    icon: 'build/icons/app/icon.icns',
  },
  publish: {
    provider: 'generic',
    url: process.env.UPDATE_SERVER_URL ?? 'http://localhost:8888',
    updaterCacheDirName: 'electron-updater',
  },
};
