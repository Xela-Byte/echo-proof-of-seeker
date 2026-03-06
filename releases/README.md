# Releases

This folder contains the built APK releases for Echo Seeker.

## Building a Release

To build an ARM64-v8a APK and automatically place it in this folder, run:

```bash
npm run build:arm64
# or
pnpm build:arm64
# or
yarn build:arm64
```

## File Naming Convention

APKs are named with the following pattern:

```
echo-seeker-v{VERSION}-arm64-{TIMESTAMP}.apk
```

Example: `echo-seeker-v1.0.0-arm64-20260306_143022.apk`

## Latest Build Symlink

A symlink named `echo-seeker-latest-arm64.apk` always points to the most recently built APK for easy access.

## Architecture

All APKs in this folder are built specifically for the **ARM64-v8a** architecture, which is the standard for modern Android devices.

## Distribution

These APKs can be distributed directly to devices for testing or production use. For Google Play Store distribution, use the EAS Build service instead:

```bash
npm run dev:client:android
```
