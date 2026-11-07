# BRZEE companion

Live BLE vehicle instruments and continuous engine sound for iOS and Android. This repository contains the complete application in `app/`, imported from the original `codex/brzee-v1` implementation. Run all commands below from `app/`.

The app starts disconnected and muted. Tap **Connect** to discover your BRZEE adapter by service UUID; choose a board if several are found. No demo, replay source, or simulated connection is available in the shipped app. Values appear only after a complete telemetry snapshot. Missing/stale inputs remain unavailable, and stale RPM/stream data fades sound out.

## Develop and verify

Use Node 22.13+, Xcode/CocoaPods for iOS, and Java 21 / Android SDK 37 for Android.

```sh
npm ci
npm run prebuild
npm run ios
# or npm run android
npm start
```

Expo Go cannot load the custom BLE/audio modules. Native folders are generated and ignored; maintain config in `app.config.ts` and native Android session code in `modules/brzee-session/`.

```sh
npm test -- --runInBand
npm run typecheck
npm run lint
node --test tools/analyze-sounds.test.mjs
```

## Release builds

`eas.json` provides a store-distribution production profile with development client disabled, automatic build numbers, and Android App Bundle output. `tests/` and screenshot tools are excluded from EAS uploads. Configure your Expo project and Apple/Google signing credentials before running `eas build --profile production --platform all`. No build is submitted or published automatically.

For an offline iOS simulator release:

```sh
xcodebuild -workspace ios/BRZEE.xcworkspace -scheme BRZEE \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/brzee-production-build CODE_SIGNING_ALLOWED=NO build
```

A physical iPhone needs a signed device Release build. For Android local builds, configure a private release keystore before distribution; the generated Expo template's default debug key is unsuitable for store distribution. EAS production builds manage signing credentials separately.

## Dashboard screenshots

[Idle](docs/images/brzee-idle-ios.png) · [City driving](docs/images/brzee-city-ios.png) · [Cruising](docs/images/brzee-cruise-ios.png)

These are native iPhone simulator captures of the real dashboard with representative telemetry, not measurements from a physical car. The separate `tests/screenshots/entry.tsx` feeds protocol-v1 notification bytes through the production BLE session, decoder, store and dashboard. It uses an in-memory vehicle and silent audio backend, so captures cannot modify saved car calibration or play engine audio. The normal `index.ts` never imports it. See [capture instructions](tests/screenshots/README.md).

## Vehicle and audio behavior

Enable sound explicitly; it starts muted on every launch. The included 911 GT3 RS profile is the only playable profile. Missing pedal uses RPM-only mixing. Output removal requires explicit re-enable; interruptions and stale telemetry use the same freshness/intent gates.

Vehicle settings retain local learning and calibration. Set idle while stationary and stable for three seconds; capture pedal endpoints with ignition on, engine off and the car stationary. Reset learning when moving the adapter to another car. The learned RPM ceiling is a working sound/display scale, not a measured redline. Coolant warning thresholds are opt-in.

See [release verification](docs/production-readiness.md), [physical acceptance](docs/device-acceptance.md), and [audio tuning](docs/audio-calibration.md). The owner confirmed stable live iPhone use of the preceding implementation on 2026-10-28. Real background/call/route acceptance, physical Android checks, acoustic tuning and release credentials remain outstanding; simulator screenshots do not establish those results. Earlier implementation records in `docs/` describe the superseded demo mode.
