declare module 'android-fastboot' {
  export function setDebugLevel(level: number): void;

  export class FastbootDevice {
    device: USBDevice | null;

    constructor();

    get isConnected(): boolean;

    connect(): Promise<void>;
    waitForConnect(onReconnect?: () => void): Promise<void>;
    waitForDisconnect(): Promise<void>;

    getVariable(varName: string): Promise<string | null>;
    runCommand(command: string): Promise<{ text: string }>;

    flashBlob(
      partition: string,
      blob: Blob,
      onProgress?: (progress: number) => void
    ): Promise<void>;

    reboot(target?: string, wait?: boolean, onReconnect?: () => void): Promise<void>;
  }
}
