import { FastbootDevice, setDebugLevel } from 'android-fastboot';
import type { FlashProgress } from '../types';

// Enable debug logging
setDebugLevel(1);

export class FastbootService {
  private device: FastbootDevice;

  constructor() {
    this.device = new FastbootDevice();
  }

  async connect(): Promise<void> {
    await this.device.connect();
  }

  isConnected(): boolean {
    return this.device.isConnected;
  }

  async getVariable(name: string): Promise<string | null> {
    try {
      return await this.device.getVariable(name);
    } catch {
      return null;
    }
  }

  async isBootloaderUnlocked(): Promise<boolean> {
    const unlocked = await this.getVariable('unlocked');
    return unlocked === 'yes';
  }

  async flashInitBoot(
    imageBlob: Blob,
    onProgress?: (progress: FlashProgress) => void
  ): Promise<void> {
    await this.device.flashBlob('init_boot', imageBlob, (progress: number) => {
      onProgress?.({
        action: 'flashing',
        partition: 'init_boot',
        progress,
      });
    });
  }

  async reboot(): Promise<void> {
    await this.device.reboot('', false);
  }

  async rebootToBootloader(): Promise<void> {
    await this.device.reboot('bootloader', false);
  }
}
