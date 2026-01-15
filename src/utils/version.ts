export interface ParsedVersion {
  modelCode: string;       // "CPH2551"
  version: string;         // "15.0.0.822"
  regionCode: string;      // "EX01"
  fullVersion: string;     // Original string
}

/**
 * Parse a OnePlus firmware version string
 * Format: CPH2551_15.0.0.822(EX01)
 */
export function parseVersion(versionString: string): ParsedVersion | null {
  // Pattern: CPH2551_15.0.0.822(EX01)
  const match = versionString.match(
    /^(CPH\d+)_(\d+\.\d+\.\d+\.\d+)\(([A-Z0-9]+)\)$/
  );

  if (!match) return null;

  return {
    modelCode: match[1],
    version: match[2],
    regionCode: match[3],
    fullVersion: versionString,
  };
}

/**
 * Check if the device model is OnePlus Open
 */
export function isOnePlusOpen(modelCode: string): boolean {
  return modelCode === 'CPH2551';
}

/**
 * Check if two version strings match exactly
 */
export function versionsMatch(deviceVersion: string, releaseTag: string): boolean {
  return deviceVersion.trim() === releaseTag.trim();
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
