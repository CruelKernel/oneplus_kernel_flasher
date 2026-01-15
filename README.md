# OnePlus Kernel Flasher

A browser-based tool for flashing Magisk-patched `init_boot.img` files to OnePlus Open devices (CPH2551) via WebUSB.

## Requirements

- Chrome, Edge, or other Chromium-based browser (WebUSB support required)
- OnePlus Open (CPH2551) with unlocked bootloader
- USB cable

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
