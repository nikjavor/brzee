> Historical implementation record. The 2026-11-07 update removes Demo from the shipped app; see [current release verification](production-readiness.md).

# Verification — 2026-10-22

Implementation branch `codex/brzee-v1`; execution used the installed executing-plans workflow in an isolated worktree. Software evidence below does not establish real car/radio or AUX behavior. The owner explicitly deferred physical testing.

## Evidence matrix

| Check | Result | Scope |
| --- | --- | --- |
| Jest host suite | 107 tests pass after field-tolerance update (2026-10-27) | Decoder/all 35 records, 3 MTUs, malformed input/sequence/timers, freshness/pedal source, sessions/retries/cancellation, control/envelope/loop processing, learning/storage/Demo and real UI controls |
| Android focus JVM regression | 2 pass | Transient loss followed by abandon emits ended-without-resume; later gain cannot revive old intent |
| TypeScript strict checking | Pass | App and host tests |
| ESLint | Pass after review fixes | Source, tests and config |
| Expo compatible versions | Pass at native setup; rechecked at handoff | SDK 58 package alignment |
| Audio analysis tests | 2 pass | RIFF chunk parsing and independent synthetic spectral peak |
| Original WAV hashes | Recorded in audit; checked against originals at handoff | No original recording edited |
| iOS Debug native build | Pass | Generic simulator; BLE/audio native libraries linked |
| iOS Release bundled build | Pass | JS and all WAV assets bundled; no Metro needed |
| iOS bundled XCTest | Pass, normal and largest Dynamic Type | iPhone 17 Pro / iOS 26.5 simulator: Demo entry, real eight-layer graph prepare, zero-volume native slider interaction, pedal-responsive state, mute, profile sheet, exit |
| Native offline envelope render | Pass, including repeated re-arm | iOS Audio API at 48kHz: pre-expiry RMS 0.4989068050, post-fade RMS 0. Re-armed at 50/90ms while retaining the original 100ms expiry |
| Android Debug native build | Pass | All native dependencies and local Expo module |
| Android Release bundled build | Pass | All ABI variants and bundled JS/assets; local debug signing |
| Android emulator layout/audio/service | Pass for Demo smoke | Pixel 10: bundled eight-layer graph reached pedal-responsive mode at zero volume; active mediaPlayback service (type0x2) observed and stopped after mute. Direct screenshots used because continuously changing instruments can prevent UIAutomator idle |
| Real BRZEE/iPhone | Owner confirmed live stability on 2026-10-28; broader acceptance pending | Discovery, MTU, notification rates, pedal support/ranges, reboot/reconnect and long streaming |
| AUX / phone calls / locked-screen | Pending | Real routing, continued input delivery, stale fades during lock and latency |
| Physical Android | Pending | BLE, service/focus/route and locked-screen behavior |
| Acoustic tuning/listening | Pending | Source RPMs/harmonic ambiguity, seam/rate bounds and on/off transitions remain preliminary |

## Build tuple and commands

Expo58.0.17, RN0.88.0, React19.3.0, BLE-plx3.5.1, Audio API0.13.6, Reanimated4.7.1, Worklets0.13.0. Node26.10.0 was used for the final host/tool checks (SDK minimum is Node22.13). Xcode27.1 (27A9275), CocoaPods1.17.0, Java21, Gradle9.4.1, Android compile/build-tools37, target36, NDK27.1.12297006. Consult the lockfile for all exact transitive versions.

Host: `npm test -- --runInBand`, `npm run typecheck`, `npm run lint`, `npx expo install --check`, `node --test tools/analyze-sounds.test.mjs`.

iOS: `xcodebuild -workspace ios/BRZEE.xcworkspace -scheme BRZEE -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/brzee-derived CODE_SIGNING_ALLOWED=NO build`, repeated with Release for offline-bundled acceptance. The XCTest helper and command are in README.

Android: `ANDROID_HOME=/Users/nikjavor/Library/Android/sdk ./gradlew assembleDebug` and `assembleRelease`, from generated `android/`. Initial SDK path/NDK prerequisites were resolved locally. The emulator initially lacked ADB authorization; a task-only emulator launch option enabled its local test session. No real phone authorization/signing was performed.

The generated native projects are deliberately untracked. Native service, focus and route behavior is source-controlled under `modules/brzee-session/`, with configuration in `app.config.ts`.

## Findings resolved during implementation

- Fixed missing Babel preset/test globals and configured SDK path; matched React's test renderer version rather than forcing a peer mismatch.
- Guarded session and connection-attempt callbacks, including cancellation while native cleanup is pending.
- Preserved sample deadlines across repeated old samples; scheduled pedal fallback independently of later JS callbacks.
- Made interruption gain zero immediate, so a suspended native audio clock cannot resume an old held tone while recovery awaits fresh snapshots.
- Reset stable-idle evidence after an unobserved interval. Serialized persistence prevents a delayed old write from undoing Reset.
- A single high RPM outlier cannot raise the scale beyond the range supported by all three confirming samples. Ordinary preference-save failures surface in the UI.
- Guarded overlapping Demo/live mode requests so a second Demo entry cannot replace the real vehicle backup.
- Added native Android connected-device service, route removal and classified focus handling where Audio API0.13.6 lacks the needed distinction. Initial mute does not request focus; permanent loss mutes, transient loss can resume only through current intent/freshness gates.
- Kept Demo identification outside scrolling content, bounded decorative branding at the largest text size, and supplied explicit accessible slider actions.

## Final independent review

A fresh reviewer completed a read-only whole-branch pass and independently reproduced the original 96-test baseline. The first reviewer attempt hit a usage limit before returning findings; an available fallback model completed the review. Three Important findings were fixed in one regression-driven pass:

- iOS interruption handling now zeros gain before suspending the native context. A permitted end serializes session reactivation and context resume after suspension; generation/route latches and current-input recovery still govern audibility. Backend, immediate-zero, rapid-end, failed-restart and delayed-route tests cover this path.
- Android focus cancellation now emits interruption ended with resume denied when abandoning an interrupted request. This clears the stale interruption latch without restoring old sound intent; a JVM test reproduces cancellation without any OS gain callback.
- Mixing now normalizes RPM/load weights in power before applying loudness trims and fixed conservative headroom. Synthetic equal-energy and actual-profile sweeps check midpoint power and the worst correlated peak bound.

The regression tests failed on the old behavior before their fixes. Final host suite: 104/104; Android focus JVM: 2/2; typecheck and lint pass. iOS Release and Android Debug/Release were rebuilt after these changes. Final bundled iOS XCTest also passed after the fixes. One Minor status defect is deferred: AUX removal while asynchronous preparation is pending can leave the message saying “Preparing your sound…”; Enable remains pressable.

Every review exclusion, execution ruling and its cost is retained in [execution record](execution-record.md). Real calls and routes remain physical acceptance gates despite the software fixes.

## Dependency advisory limitation

`npm audit` on the installed lockfile reports **47 affected dependency entries: 29 high and 18 moderate**, with no critical entries. These propagate from three leaf advisories in build/test tooling:

- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), installed/latest 3.0.3.
- [node-forge signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv), installed/latest 1.4.0.
- [sprintf-js precision denial of service](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), installed/latest 1.1.3.

No patched leaf release was published in the checked registry. Audit proposes incompatible Expo/RN downgrades; `npm audit fix --force` was not applied. The affected paths are Expo CLI/Metro and Babel/Jest-related tooling, not intentionally imported vehicle/audio runtime code. This remains an unresolved dependency limitation and must be rechecked before distributing the app or processing untrusted build inputs.

## Remaining acceptance

Pedal D and E returned samples in the physical trace; full pedal travel/calibration remains unverified. No source RPM metadata or human listening signoff has been obtained. No input-to-AUX latency, long-running background delivery, thermal/memory result or real call/unplug behavior has been measured. Follow [device acceptance](device-acceptance.md) and [audio calibration](audio-calibration.md) before calling the app physically accepted.

Native screenshots: [iOS Demo](../../images/brzee-cruise-ios.png). These show simulated telemetry. Emulator headphone-switch events did not provide a usable output-device route test; real unplug behavior remains pending.


## Field update — 2026-10-27

BRZEE `da0b447-telemetry1` was flashed with application-only writes and a verified checksum; startup and phone reconnection were observed. The owner reported reduced but remaining dropouts and requested more tolerant app handling. See [the investigation](firmware/2026-10-27-telemetry-investigation.md) for the firmware regressions, physical logs and current app policy. Three app regressions were observed RED→GREEN; current suite 107/107, typecheck and lint pass. Signed iPhone Release build 2 compiled successfully, was installed and launched, and its installed build number was verified. Its JavaScript/assets are bundled. On 2026-10-28 the owner confirmed “Stable now” after testing build 2 with the updated firmware.


A subsequent read-only iPhone screenshot confirmed the non-Demo dashboard displaying RPM/speed/pedal and the pedal-responsive audio state after the update. The owner subsequently confirmed stable live use on 2026-10-28 in response to the dropout/pedal-smoothness validation question; no test duration was supplied. No new physical Android claim is made by this field update.
