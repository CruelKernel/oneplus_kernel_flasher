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

  /**
   * Sends the reboot-to-bootloader command and drops the connection.
   *
   * The device leaves the USB bus as soon as it acts on the command, so the transfer
   * that carries it usually fails ("A transfer error has occurred") even though the
   * reboot did happen. That failure is reported as a warning instead of an error;
   * whether the device actually came back is decided by the fastboot connection.
   */
  async rebootToBootloader(): Promise<string | null> {
    if (!this.adb) {
      throw new Error('Not connected to device');
    }

    const adb = this.adb;
    this.adb = null;

    try {
      await adb.power.bootloader();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    } finally {
      await adb.close().catch(() => {});
    }
  }

  async disconnect(): Promise<void> {
    if (this.adb) {
      const adb = this.adb;
      this.adb = null;
      // The device may already be gone, which makes closing the streams fail
      await adb.close().catch(() => {});
    }
  }

  isConnected(): boolean {
    return this.adb !== null;
  }
}
