# Production preparation — 2026-11-07

The merged repository initially contained only the app's assets and design documents. The complete, clean implementation from `/Users/nikjavor/repos/brzee-app/.worktrees/brzee-v1` at `15fd712` is now included directly in `app/`. The original checkout is unchanged.

## Changes

- Removed the demo replay implementation, runtime methods/state, entry button, scenario controls, banners, and temporary-learning branches. The normal entry point opens disconnected and muted and receives telemetry only from the native BLE transport.
- Kept cancellation tokens, reconnect handling, stale-signal deadlines, sound recovery and local vehicle persistence. Corrected the stuck preparation message when output is removed while sound is loading.
- Applied BRZEE naming consistently throughout the imported implementation.
- Added an EAS production store profile with development client disabled, automatic build numbering and Android App Bundle output. Native build identifiers are version 1.0.0, build 3.
- Added a separate screenshot entry under `tests/screenshots/`. It uses protocol-v1 notification fixtures, the real BLE session/decoder/store/view, no persistent storage and a silent audio backend. Neither `index.ts` nor production source imports it; tests/tools are excluded from EAS uploads.
- Applied compatible dependency fixes with `npm audit fix --ignore-scripts`, updating the lockfile, including node-forge 1.4.3. No forced framework downgrade was applied.

## Verified in this checkout

| Check | Result |
| --- | --- |
| `npm test -- --runInBand` | 107 tests pass across 19 suites |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `node --test tools/analyze-sounds.test.mjs` | 2 tests pass |
| Expo dependency alignment | Pass against the installed SDK dependency map; network version endpoint unavailable |
| Production iOS JS export | Pass; 1,251 source-map entries, no `tests/` or `src/demo/` modules, no demo entry strings |
| iOS Release native build | Pass; universal simulator build, bundled JS/assets, build 3 |
| iOS production XCTest | 1 test passes on iPhone 17 Pro / iOS 26.5: Connect present, no Demo/LIVE/Mute state at startup |
| Android Release native build | Pass; arm64-v8a local APK, bundled JS/assets; template debug signing, not a store artifact |
| Android audio-focus JVM regressions | 2 tests pass |
| Native screenshot QA | Idle, city, cruise and restored production connection screen captured at 1206 × 2622 and visually inspected |

The screenshots are representative telemetry in an iPhone simulator, not physical car measurements. The production build was reinstalled after capture. See [screenshots](../tests/screenshots/README.md) for reproducible capture instructions and [app setup](../README.md) for development/release commands.

The native build commands used from `app/` were:

```sh
xcodebuild -workspace ios/BRZEE.xcworkspace -scheme BRZEE \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/brzee-production-build CODE_SIGNING_ALLOWED=NO build

env GEM_HOME=/opt/homebrew/opt/cocoapods/libexec ruby tools/prepare-ios-smoke.rb
xcodebuild -project /tmp/brzee-ui-smoke/BRZEESmoke.xcodeproj \
  -scheme BRZEESmoke \
  -destination 'platform=iOS Simulator,id=5EE33E63-F682-4BFE-B902-3083FF706AA6' \
  -derivedDataPath /tmp/brzee-ui-derived CODE_SIGNING_ALLOWED=NO test
```

From `app/android/`:

```sh
env JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home \
  ANDROID_HOME=/Users/nikjavor/Library/Android/sdk \
  ./gradlew :app:assembleRelease :brzee-session:testDebugUnitTest \
  --offline --max-workers=2 -PreactNativeArchitectures=arm64-v8a
```

## Remaining release gates

These changes remove Demo and establish reproducible Release builds; they do not establish store or full physical acceptance.

- Configure the Expo project, Apple/Google release credentials and final store artwork/listing. Do not distribute the locally debug-signed Android APK. No app was uploaded or published.
- Finish real-device BLE/background/locked-screen, call/route, calibration, AUX latency and physical Android checks from [device acceptance](device-acceptance.md). The owner's 2026-10-28 live iPhone stability confirmation applies to the preceding implementation; no new physical-car test was performed here.
- Confirm the preliminary sound-loop/source-RPM tuning with actual listening and source metadata; see [audio calibration](audio-calibration.md).
- Current npm audit still reports **33 affected entries: 2 high, 30 moderate, 1 low**. The remaining leaf advisories involve glob, minimatch, deepmerge and Zod in build/test tooling. None of those leaf packages appears in the exported production JS module graph. The available audit remedy requires incompatible dependency changes; this remains an unresolved toolchain limitation and must be reviewed before store distribution. The audit report is `/tmp/brzee-final-audit.json` for this session.

Earlier verification/execution documents and Demo screenshots remain as historical evidence of the original implementation. Current screenshots are `brzee-{idle,city,cruise,connect}-ios.png`.
