declare const __SOURCE_FILE__: string;

interface ElectronEnv {
  platform: NodeJS.Platform;
}

declare const electronEnv: ElectronEnv;

interface Window {
  electronEnv: ElectronEnv;
}
