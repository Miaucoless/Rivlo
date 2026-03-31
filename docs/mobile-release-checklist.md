# Rivora App Store Release Checklist

## Code And Native Shell

- [ ] Finalize the live production URL used by Capacitor
- [ ] Replace [resources/logo.png](/Users/miaucoles/Downloads/Fitness/Fitness/resources/logo.png) with the final 1024px+ brand asset
- [ ] Run `npm run mobile:assets`
- [ ] Run `npm run mobile:sync`
- [ ] Verify barcode scan, nutrition-label scan, sharing, auth, and reminders on a real iPhone
- [ ] Verify barcode scan, nutrition-label scan, sharing, auth, and reminders on a real Android device
- [ ] Confirm portrait behavior is correct across dashboard, meals, calendar, and workouts

## iPhone / App Store

- [ ] Open [ios/App/App.xcodeproj](/Users/miaucoles/Downloads/Fitness/Fitness/ios/App/App.xcodeproj) in Xcode
- [ ] Set Apple Developer team and signing
- [ ] Set release bundle identifier, version, and build number
- [ ] Verify app icon and launch screen look correct on device
- [ ] Add privacy policy URL and support URL in App Store Connect
- [ ] Provide an App Review demo account
- [ ] Verify account deletion is easy to find in Settings
- [ ] Add StoreKit / native billing for paid digital features before submission
- [ ] Add iPhone screenshots and App Store metadata
- [ ] Upload to TestFlight and do a full beta pass

## Android / Google Play

- [ ] Open [android](/Users/miaucoles/Downloads/Fitness/Fitness/android) in Android Studio
- [ ] Set release signing config
- [ ] Set version code and version name
- [ ] Build an Android App Bundle (`.aab`)
- [ ] Fill out Play Console Data safety form
- [ ] Fill out content rating and app access
- [ ] Add privacy policy URL and support URL
- [ ] Add Play Billing for paid digital features before release
- [ ] Add phone and tablet screenshots
- [ ] Run internal testing in Play Console before production

## Deep Links And Domain Verification

- [ ] Keep `rivora://` custom scheme working
- [ ] Add Apple universal link association file once Apple Team ID is final
- [ ] Add Android `assetlinks.json` once Play signing certificate fingerprint is final
- [ ] Set `APPLE_APP_SITE_ASSOCIATION_APP_IDS`
- [ ] Set `ANDROID_APP_LINK_PACKAGE_NAME`
- [ ] Set `ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS`
- [ ] Verify links from email, share pages, and password reset flows open the right screens

## Policy / Compliance

- [ ] In-app privacy policy screen or accessible privacy-policy link
- [ ] Terms of service link
- [ ] Clear camera/photo permission rationale
- [ ] Clear delete-account path
- [ ] Review any health/weight claims in copy before submission
- [ ] Confirm no paid digital features bypass Apple / Google billing
