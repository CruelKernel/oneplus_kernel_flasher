import { useState, useCallback, useRef } from 'react';
import type { FlashState, AppState, DeviceInfo, DownloadProgress, FlashProgress } from './types';
import { AdbService } from './services/adb';
import { FastbootService } from './services/fastboot';
import { GitHubService } from './services/github';
import { downloadAsset } from './services/download';
import { parseVersion, isOnePlusOpen, formatFileSize } from './utils/version';

const initialState: AppState = {
  state: 'IDLE',
  deviceInfo: null,
  matchedRelease: null,
  imageBlob: null,
  downloadProgress: null,
  flashProgress: null,
  error: null,
  logs: [],
};

function App() {
  const [appState, setAppState] = useState<AppState>(initialState);
  const adbService = useRef(new AdbService());
  const fastbootService = useRef(new FastbootService());
  const githubService = useRef(new GitHubService());

  const addLog = useCallback((message: string) => {
    setAppState(prev => ({
      ...prev,
      logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${message}`],
    }));
  }, []);

  const setState = useCallback((state: FlashState, extra: Partial<AppState> = {}) => {
    setAppState(prev => ({ ...prev, state, ...extra }));
  }, []);

  const setError = useCallback((error: string) => {
    addLog(`Error: ${error}`);
    setState('ERROR', { error });
  }, [addLog, setState]);

  // Check browser support
  const checkBrowser = useCallback(() => {
    if (!AdbService.isSupported()) {
      addLog('WebUSB is not supported in this browser');
      setState('BROWSER_UNSUPPORTED');
      return false;
    }
    addLog('WebUSB is supported');
    return true;
  }, [addLog, setState]);

  // Detect firmware version
  const detectFirmware = useCallback(async () => {
    setState('DETECTING_FIRMWARE');
    addLog('Reading device information...');

    try {
      const deviceInfo = await adbService.current.getDeviceInfo();
      addLog(`Device: ${deviceInfo.model}`);
      addLog(`Firmware: ${deviceInfo.firmwareVersion}`);

      // Validate device
      const parsed = parseVersion(deviceInfo.firmwareVersion);
      if (!parsed || !isOnePlusOpen(parsed.modelCode)) {
        setError('This tool only supports OnePlus Open (CPH2551)');
        return null;
      }

      setState('FIRMWARE_DETECTED', { deviceInfo });
      return deviceInfo;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to read device info: ${message}`);
      return null;
    }
  }, [addLog, setState, setError]);

  // Find matching GitHub release
  const findRelease = useCallback(async (deviceInfo: DeviceInfo) => {
    setState('FETCHING_RELEASES');
    addLog('Fetching available releases...');

    try {
      const release = await githubService.current.findMatchingRelease(deviceInfo.firmwareVersion);

      if (!release) {
        addLog(`No release found for firmware ${deviceInfo.firmwareVersion}`);
        setState('RELEASE_NOT_FOUND');
        return;
      }

      const asset = githubService.current.getPatchedImageAsset(release);
      if (!asset) {
        setError('Release found but no patched image available');
        return;
      }

      addLog(`Found matching release: ${release.tag_name}`);
      addLog(`Patched image: ${asset.name} (${formatFileSize(asset.size)})`);
      setState('RELEASE_MATCHED', { matchedRelease: release });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to fetch releases: ${message}`);
    }
  }, [addLog, setState, setError]);

  // Connect to device via ADB
  const connectAdb = useCallback(async () => {
    if (!checkBrowser()) return;

    setState('ADB_CONNECTING');
    addLog('Connecting to device via ADB...');

    try {
      await adbService.current.connect();
      addLog('ADB connection established');
      setState('ADB_CONNECTED');

      // Automatically proceed to firmware detection
      const deviceInfo = await detectFirmware();
      if (deviceInfo) {
        await findRelease(deviceInfo);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('No device selected')) {
        setState('WAITING_ADB_CONNECT');
        addLog('Device selection cancelled');
      } else {
        setError(`ADB connection failed: ${message}`);
      }
    }
  }, [checkBrowser, addLog, setState, setError, detectFirmware, findRelease]);

  // Download the patched image
  const downloadImage = useCallback(async () => {
    const release = appState.matchedRelease;
    if (!release) return;

    const asset = githubService.current.getPatchedImageAsset(release);
    if (!asset) return;

    setState('DOWNLOADING_IMAGE', { downloadProgress: { loaded: 0, total: asset.size, percentage: 0 } });
    addLog('Downloading patched image...');

    try {
      const blob = await downloadAsset(asset.browser_download_url, (progress: DownloadProgress) => {
        setAppState(prev => ({ ...prev, downloadProgress: progress }));
      });

      addLog(`Download complete: ${formatFileSize(blob.size)}`);
      setState('DOWNLOAD_COMPLETE', { imageBlob: blob, downloadProgress: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Download failed: ${message}`);
    }
  }, [appState.matchedRelease, addLog, setState, setError]);

  // Confirm and start flash
  const confirmFlash = useCallback(() => {
    setState('CONFIRMING_FLASH');
  }, [setState]);

  // Reboot to bootloader
  const rebootToBootloader = useCallback(async () => {
    setState('REBOOTING_BOOTLOADER');
    addLog('Rebooting to bootloader...');

    try {
      await adbService.current.rebootToBootloader();
      await adbService.current.disconnect();
      addLog('Device is rebooting to bootloader');
      addLog('Please wait for the device to enter fastboot mode...');
      setState('WAITING_FASTBOOT');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to reboot: ${message}`);
    }
  }, [addLog, setState, setError]);

  // Flash the image
  const flashImage = useCallback(async () => {
    if (!appState.imageBlob) return;

    setState('FLASHING', { flashProgress: { action: 'preparing', partition: 'init_boot', progress: 0 } });
    addLog('Flashing init_boot partition...');

    try {
      await fastbootService.current.flashInitBoot(appState.imageBlob, (progress: FlashProgress) => {
        setAppState(prev => ({ ...prev, flashProgress: progress }));
      });

      addLog('Flash complete!');
      setState('FLASH_COMPLETE', { flashProgress: null });

      // Automatically reboot
      await rebootSystem();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Flash failed: ${message}`);
    }
  }, [appState.imageBlob, addLog, setState, setError]);

  // Reboot to system
  const rebootSystem = useCallback(async () => {
    setState('REBOOTING_SYSTEM');
    addLog('Rebooting to system...');

    try {
      await fastbootService.current.reboot();
      addLog('Device is rebooting');
      setState('SUCCESS');
    } catch {
      // Reboot command might not return properly, treat as success
      addLog('Reboot command sent');
      setState('SUCCESS');
    }
  }, [addLog, setState]);

  // Connect to device in fastboot mode
  const connectFastboot = useCallback(async () => {
    setState('FASTBOOT_CONNECTING');
    addLog('Connecting to device in fastboot mode...');

    try {
      await fastbootService.current.connect();

      if (!fastbootService.current.isConnected()) {
        throw new Error('Failed to establish fastboot connection');
      }

      // Check if bootloader is unlocked
      const unlocked = await fastbootService.current.isBootloaderUnlocked();
      if (!unlocked) {
        setError('Bootloader is locked. Please unlock it first before flashing.');
        return;
      }

      addLog('Fastboot connection established');
      addLog('Bootloader is unlocked');
      setState('FASTBOOT_CONNECTED');

      // Automatically start flashing
      await flashImage();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('No device selected') || message.includes('cancelled')) {
        setState('WAITING_FASTBOOT');
        addLog('Device selection cancelled');
      } else {
        setError(`Fastboot connection failed: ${message}`);
      }
    }
  }, [addLog, setState, setError, flashImage]);

  // Reset to initial state
  const reset = useCallback(() => {
    adbService.current = new AdbService();
    fastbootService.current = new FastbootService();
    setAppState(initialState);
  }, []);

  // Render UI based on state
  const renderContent = () => {
    switch (appState.state) {
      case 'IDLE':
      case 'WAITING_ADB_CONNECT':
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">Connect Your Device</h2>
            <p className="text-gray-400 mb-6">
              Make sure USB debugging is enabled and the device is connected via USB.
            </p>
            <button
              onClick={connectAdb}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Connect Device
            </button>
          </div>
        );

      case 'BROWSER_UNSUPPORTED':
        return (
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">!</div>
            <h2 className="text-xl font-semibold mb-4">Browser Not Supported</h2>
            <p className="text-gray-400">
              This tool requires WebUSB which is only available in Chrome, Edge, or other Chromium-based browsers.
            </p>
          </div>
        );

      case 'ADB_CONNECTING':
        return (
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Connecting to device...</p>
            <p className="text-gray-500 text-sm mt-2">Accept the USB debugging prompt on your device if shown.</p>
          </div>
        );

      case 'ADB_CONNECTED':
      case 'DETECTING_FIRMWARE':
        return (
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Reading device information...</p>
          </div>
        );

      case 'FIRMWARE_DETECTED':
      case 'FETCHING_RELEASES':
        return (
          <div className="text-center">
            {appState.deviceInfo && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4 text-left">
                <h3 className="font-semibold mb-2">Device Information</h3>
                <p className="text-gray-400">Model: {appState.deviceInfo.model}</p>
                <p className="text-gray-400">Firmware: {appState.deviceInfo.firmwareVersion}</p>
              </div>
            )}
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Looking for matching release...</p>
          </div>
        );

      case 'RELEASE_NOT_FOUND':
        return (
          <div className="text-center">
            {appState.deviceInfo && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4 text-left">
                <h3 className="font-semibold mb-2">Device Information</h3>
                <p className="text-gray-400">Firmware: {appState.deviceInfo.firmwareVersion}</p>
              </div>
            )}
            <div className="text-yellow-500 text-5xl mb-4">!</div>
            <h2 className="text-xl font-semibold mb-4">No Release Found</h2>
            <p className="text-gray-400 mb-6">
              No patched image is available for your firmware version yet.
            </p>
            <button
              onClick={reset}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Start Over
            </button>
          </div>
        );

      case 'RELEASE_MATCHED':
        return (
          <div className="text-center">
            {appState.deviceInfo && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4 text-left">
                <h3 className="font-semibold mb-2">Device Information</h3>
                <p className="text-gray-400">Model: {appState.deviceInfo.model}</p>
                <p className="text-gray-400">Firmware: {appState.deviceInfo.firmwareVersion}</p>
              </div>
            )}
            {appState.matchedRelease && (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-green-400 mb-2">Release Found</h3>
                <p className="text-gray-400">Version: {appState.matchedRelease.tag_name}</p>
                <p className="text-gray-400">
                  Size: {formatFileSize(
                    githubService.current.getPatchedImageAsset(appState.matchedRelease)?.size || 0
                  )}
                </p>
              </div>
            )}
            <button
              onClick={downloadImage}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Download Patched Image
            </button>
          </div>
        );

      case 'DOWNLOADING_IMAGE':
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">Downloading...</h2>
            {appState.downloadProgress && (
              <>
                <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-200"
                    style={{ width: `${appState.downloadProgress.percentage}%` }}
                  ></div>
                </div>
                <p className="text-gray-400">
                  {formatFileSize(appState.downloadProgress.loaded)} / {formatFileSize(appState.downloadProgress.total)}
                  {' '}({appState.downloadProgress.percentage.toFixed(1)}%)
                </p>
              </>
            )}
          </div>
        );

      case 'DOWNLOAD_COMPLETE':
        return (
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-4">&#10003;</div>
            <h2 className="text-xl font-semibold mb-4">Download Complete</h2>
            <p className="text-gray-400 mb-6">
              Ready to flash. This will reboot your device to bootloader mode.
            </p>
            <button
              onClick={confirmFlash}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Continue to Flash
            </button>
          </div>
        );

      case 'CONFIRMING_FLASH':
        return (
          <div className="text-center">
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-yellow-400 mb-2">Warning</h3>
              <ul className="text-gray-400 text-sm list-disc list-inside space-y-1">
                <li>Your bootloader must be unlocked</li>
                <li>This will flash the init_boot partition</li>
                <li>The device will reboot during this process</li>
                <li>You will need to re-select the device in fastboot mode</li>
              </ul>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={reset}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={rebootToBootloader}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Flash Now
              </button>
            </div>
          </div>
        );

      case 'REBOOTING_BOOTLOADER':
        return (
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Rebooting to bootloader...</p>
          </div>
        );

      case 'WAITING_FASTBOOT':
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">Connect in Fastboot Mode</h2>
            <p className="text-gray-400 mb-6">
              Your device should now be in fastboot mode. Click the button below to connect.
            </p>
            <button
              onClick={connectFastboot}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Connect Fastboot
            </button>
          </div>
        );

      case 'FASTBOOT_CONNECTING':
        return (
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Connecting in fastboot mode...</p>
          </div>
        );

      case 'FASTBOOT_CONNECTED':
      case 'FLASHING':
        return (
          <div className="text-center">
            <div className="animate-pulse w-12 h-12 bg-orange-500 rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-4">Flashing...</h2>
            {appState.flashProgress && (
              <>
                <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
                  <div
                    className="bg-orange-600 h-4 rounded-full transition-all duration-200"
                    style={{ width: `${appState.flashProgress.progress * 100}%` }}
                  ></div>
                </div>
                <p className="text-gray-400">
                  {appState.flashProgress.action} {appState.flashProgress.partition}
                  {' '}({(appState.flashProgress.progress * 100).toFixed(1)}%)
                </p>
              </>
            )}
            <p className="text-red-400 text-sm mt-4">Do not disconnect your device!</p>
          </div>
        );

      case 'FLASH_COMPLETE':
      case 'REBOOTING_SYSTEM':
        return (
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Rebooting to system...</p>
          </div>
        );

      case 'SUCCESS':
        return (
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">&#10003;</div>
            <h2 className="text-2xl font-semibold mb-4">Flash Complete!</h2>
            <p className="text-gray-400 mb-6">
              Your device has been flashed with Magisk. After it boots, install the Magisk app to complete the setup.
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href="https://github.com/topjohnwu/Magisk/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Download Magisk App
              </a>
              <button
                onClick={reset}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        );

      case 'ERROR':
        return (
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">&#10007;</div>
            <h2 className="text-xl font-semibold mb-4">Error</h2>
            <p className="text-red-400 mb-6">{appState.error}</p>
            <button
              onClick={reset}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Start Over
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">OnePlus Open Flasher</h1>
          <p className="text-gray-400">Flash Magisk-patched init_boot.img via WebUSB</p>
        </header>

        <main className="bg-gray-800 rounded-xl p-6 mb-6">
          {renderContent()}
        </main>

        <section className="bg-gray-800 rounded-xl p-4">
          <h3 className="font-semibold mb-2 text-sm text-gray-400">Log</h3>
          <div className="bg-gray-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs">
            {appState.logs.length === 0 ? (
              <p className="text-gray-600">Waiting for action...</p>
            ) : (
              appState.logs.map((log, i) => (
                <div key={i} className="text-gray-400">{log}</div>
              ))
            )}
          </div>
        </section>

        <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>
            <a
              href="https://github.com/CruelKernel/oneplus_kernel_patcher"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300"
            >
              GitHub Repository
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
