# Rivora Mobile Packaging

Rivora now includes Capacitor scaffolding so the current Next.js app can ship as native iPhone and Android apps without a rewrite.

## What this setup does

- Wraps the deployed Rivora web app inside native iOS and Android shells
- Keeps the existing Next.js + Vercel app as the single UI codebase
- Gives you native projects for App Store and Play Store submission

## Config

The native shell reads its app URL from:

- `CAPACITOR_APP_URL`
- or `NEXT_PUBLIC_APP_URL`
- fallback: `https://rivorafit.com`

For production builds, point this to the real live app domain.

## First-time setup

```bash
npm run mobile:add:ios
npm run mobile:add:android
```

## Daily commands

```bash
npm run mobile:sync
npm run mobile:assets
npm run mobile:open:ios
npm run mobile:open:android
```

`mobile:sync` updates the native projects after package or Capacitor config changes.

`mobile:assets` regenerates iOS, Android, and PWA icons/splash screens from [resources/logo.png](/Users/miaucoles/Downloads/Fitness/Fitness/resources/logo.png).

## Branding assets

The repo now uses a single source image:

- [resources/logo.png](/Users/miaucoles/Downloads/Fitness/Fitness/resources/logo.png)

Replace that file with the final high-resolution Rivora mark before release, then run:

```bash
npm run mobile:assets
npm run mobile:sync
```

## Deep links

The native shells now support:

- `rivora://...`
- `https://rivorafit.com/...` on Android
- `https://www.rivorafit.com/...` on Android

For full iOS universal links and verified Android app links, you still need the production domain association files and store-signing data:

- Apple: `apple-app-site-association`
- Android: `assetlinks.json`

Those are now served by repo routes, but they depend on environment values you must supply when release signing is finalized:

- `APPLE_APP_SITE_ASSOCIATION_APP_IDS`
  Example: `TEAMID.com.rivorafit.app`
- `ANDROID_APP_LINK_PACKAGE_NAME`
  Example: `com.rivorafit.app`
- `ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS`
  Comma-separated Play signing fingerprints

## Recommended next steps before store submission

1. Add the iOS and Android projects to the repo and set real signing/team information.
2. Replace any web-only permission flows with native-tested ones for camera, push notifications, and deep linking.
3. Add native billing for paid digital features.
4. Verify account deletion is easy to find in Settings.
5. Add store assets:
   screenshots, icon set, privacy policy URL, support URL, age rating, and descriptions.
6. Test on real devices through TestFlight and Play internal testing before public release.

## Important note

This setup packages the live hosted Rivora app inside native shells. That is the lowest-friction path for this codebase, but App Store approval still depends on app quality, native polish, privacy compliance, and subscription/payment rules.
