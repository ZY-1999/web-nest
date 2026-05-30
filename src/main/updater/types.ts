export interface UpdateConfig {
  updateServerURL: string;
  autoCheckOnStartup: boolean;
  autoDownload: boolean;
  checkInterval: number;
}

export interface UpdateProgressInfo {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  files: Array<{
    url: string;
    size: number;
    sha512: string;
  }>;
  path: string;
  sha512: string;
  releaseName?: string;
  releaseNotes?: string;
}
