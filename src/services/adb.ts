import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import type { DeviceInfo } from '../types';

export class AdbService {
  private adb: Adb | null = null;
  private credentialStore = new AdbWebCredentialStore('oneplus-flasher');

  static isSupported(): boolean {
    return AdbDaemonWebUsbDeviceManager.BROWSER !== undefined;
  }

  async connect(): Promise<void> {
    const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
    if (!manager) {
      throw new Error('WebUSB is not supported in this browser');
    }

    const device = await manager.requestDevice();
    if (!device) {
      throw new Error('No device selected');
    }

    const connection = await device.connect();
    const transport = await AdbDaemonTransport.authenticate({
      serial: device.serial,
      connection,
      credentialStore: this.credentialStore,
    });

    this.adb = new Adb(transport);
  }

  async getProperty(propName: string): Promise<string> {
    if (!this.adb) {
      throw new Error('Not connected to device');
    }
    return await this.adb.getProp(propName);
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    if (!this.adb) {
      throw new Error('Not connected to device');
    }

    const [model, firmwareVersion] = await Promise.all([
      this.getProperty('ro.product.model'),
      this.getProperty('ro.build.display.id'),
    ]);

    return {
      model,
      firmwareVersion,
      serial: this.adb.serial,
    };
  }

  async rebootToBootloader(): Promise<void> {
    if (!this.adb) {
      throw new Error('Not connected to device');
    }
    await this.adb.power.bootloader();
  }

  async disconnect(): Promise<void> {
    if (this.adb) {
      await this.adb.close();
      this.adb = null;
    }
  }

  isConnected(): boolean {
    return this.adb !== null;
  }
}
