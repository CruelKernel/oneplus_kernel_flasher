export type FlashState =
  | 'IDLE'
  | 'BROWSER_UNSUPPORTED'
  | 'WAITING_ADB_CONNECT'
  | 'ADB_CONNECTING'
  | 'ADB_CONNECTED'
  | 'DETECTING_FIRMWARE'
  | 'FIRMWARE_DETECTED'
  | 'FETCHING_RELEASES'
  | 'RELEASE_NOT_FOUND'
  | 'RELEASE_MATCHED'
  | 'DOWNLOADING_IMAGE'
  | 'DOWNLOAD_COMPLETE'
  | 'CONFIRMING_FLASH'
  | 'REBOOTING_BOOTLOADER'
  | 'WAITING_FASTBOOT'
  | 'FASTBOOT_CONNECTING'
  | 'FASTBOOT_CONNECTED'
  | 'FLASHING'
  | 'FLASH_COMPLETE'
  | 'REBOOTING_SYSTEM'
  | 'SUCCESS'
  | 'ERROR';

export interface DeviceInfo {
  model: string;
  firmwareVersion: string;
  serial?: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FlashProgress {
  action: string;
  partition: string;
  progress: number;
}

export interface AppState {
  state: FlashState;
  deviceInfo: DeviceInfo | null;
  matchedRelease: GitHubRelease | null;
  imageBlob: Blob | null;
  downloadProgress: DownloadProgress | null;
  flashProgress: FlashProgress | null;
  error: string | null;
  logs: string[];
}
