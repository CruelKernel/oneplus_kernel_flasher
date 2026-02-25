# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based tool for flashing Magisk-patched `init_boot.img` to OnePlus Open (CPH2551) via WebUSB. Requires Chromium-based browsers (Chrome, Edge) — no Firefox/Safari support. Fetches patched images from the CruelKernel/oneplus_kernel_patcher GitHub repository and matches them to the device's firmware version.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npm run preview      # Preview production build
docker compose up    # Docker dev at http://localhost:8080
```

## Architecture

**Single-page React app** built with Vite + TypeScript + Tailwind CSS.

### State Machine (`src/App.tsx`)

The app is driven by a `FlashState` union type (23 states) that controls the entire UI and workflow:

`IDLE → ADB_CONNECTING → ADB_CONNECTED → DETECTING_FIRMWARE → FIRMWARE_DETECTED → FETCHING_RELEASES → RELEASE_MATCHED → DOWNLOADING_IMAGE → DOWNLOAD_COMPLETE → CONFIRMING_FLASH → REBOOTING_BOOTLOADER → WAITING_FASTBOOT → FASTBOOT_CONNECTING → FASTBOOT_CONNECTED → FLASHING → FLASH_COMPLETE → REBOOTING_SYSTEM → SUCCESS`

State transitions happen in `App.tsx` which is the main (~600 line) component containing all UI rendering and orchestration logic.

### Services (`src/services/`)

- **adb.ts** — WebUSB ADB connection via `@yume-chan/adb`. Reads device model, firmware version, serial number. Reboots to bootloader.
- **fastboot.ts** — Fastboot protocol via `android-fastboot`. Validates unlocked bootloader, flashes `init_boot` partition with progress callbacks.
- **github.ts** — Fetches releases from CruelKernel/oneplus_kernel_patcher. Caches in memory. Matches device firmware version to release tags (exact match on format `CPH2551_15.0.0.822(EX01)`).
- **download.ts** — Downloads GitHub release assets through a CORS proxy (`api.codetabs.com`). Streams with progress tracking.

### Types (`src/types/`)

- **index.ts** — Core types: `FlashState`, `DeviceInfo`, `AppState`, progress types, GitHub API types.
- **android-fastboot.d.ts** — Type declarations for the untyped `android-fastboot` library.

### Utils (`src/utils/version.ts`)

Parses firmware version strings (regex: `CPH\d+_\d+\.\d+\.\d+\.\d+\([A-Z0-9]+\)`), validates device is CPH2551, formats file sizes.

## Key Patterns

- Services are held as refs (`useRef`) in App.tsx — singleton instances persisted across renders.
- ADB credentials stored in browser localStorage under key `'oneplus-flasher'`.
- GitHub Pages deployment via `.github/workflows/deploy.yml` uses `VITE_BASE_PATH` env var for subdirectory routing.
- No test framework is configured.
