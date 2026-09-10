# OnePlus Kernel Flasher

A browser-based tool for flashing Magisk-patched `init_boot.img` files to OnePlus Open devices (CPH2551) via WebUSB.

## Requirements

- Chrome, Edge, or other Chromium-based browser (WebUSB support required)
- OnePlus Open (CPH2551) with unlocked bootloader
- USB cable

## Manual download

The patched image is fetched from GitHub through a public CORS proxy, which is not always
available. If the automatic download fails, the app shows a "Download from GitHub" link: save
`magisk_patched_init_boot.img` from the matching release, then pick it with "Select Downloaded
File". The same picker is available as "Use Local init_boot.img" on the "Release Found" card. The
file size must match the release asset exactly.

## Development

```bash
npm install
npm run dev       # Start development server
npm run build     # Build for production
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

## Docker

```bash
# Using Docker Compose (recommended)
docker compose up

# Or build and run manually
docker build -t oneplus-kernel-flasher .
docker run -p 8080:3000 oneplus-kernel-flasher
```

The app will be available at `http://localhost:8080`.
