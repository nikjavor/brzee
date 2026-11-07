> Historical implementation record. The 2026-11-07 update removes Demo from the shipped app; see [current release verification](production-readiness.md).

# Acceptance record

Physical hardware testing was explicitly deferred by the owner. **No real BLE, AUX, locked-screen, interruption or Android-device acceptance is claimed.** A successful native build and simulator probe are software evidence only.

## Available checks

- Expo58.0.17 / React Native0.88.0 / React19.3.0 / Audio API0.13.6 / BLE-plx3.5.1.
- Xcode27.1, iOS simulator native build succeeded; iPhone17/iOS26.5 simulator launched the app. Native AudioManager reports 48,000 Hz.
- Android debug build succeeded with SDK37, target36, NDK27.1.12297006, Gradle9.4.1, Java21; local BrzeeSession Expo module is autolinked and compiled.
- Automated protocol, freshness, session-generation, sound-policy, seam-processing and envelope tests run through `npm test -- --runInBand`. See final verification for the current count.
- Development builds run an offline native audio probe: oscillator → scheduled master gain → native rendered PCM. It passed at 48kHz, including re-arming at 50/90ms without extending the original 100ms deadline: pre-expiry RMS0.4989068050; post-fade RMS0.
- Bundled iOS XCTest passed on iPhone17Pro/iOS26.5 simulator at normal and largest text sizes, including actual decoding/preparation of all eight sample layers at zero volume. Android Pixel10 emulator reached the same pedal-responsive state at zero volume, showed a mediaPlayback service (type0x2), and stopped that Demo service after mute. These are simulated-input checks.

## Platform implementation

iOS declares bluetooth-central/audio background modes and uses playback audio (silent-switch bypass) with mixWithOthers. Interruption and route changes feed the same intent latches as the UI. Music mixing is configured but has not been tested with another app.

Android uses a local foreground session service because Audio API0.13.6's service only activates playback/recording types, even if connectedDevice is declared in its manifest. BRZEE's service activates connectedDevice for the live BLE session, adds mediaPlayback when sound is enabled, and shows one ongoing notification. It runs while sound is muted, ends with manual session teardown, and requests session teardown on task removal. No recording permission is requested. Notification/Bluetooth permissions and background-start restrictions still need device checks. Android behavior follows the [documented service type prerequisites](https://developer.android.com/develop/background-work/services/fgs/service-types#connected-device).

The local Android module also observes wired/USB/private-output removal and owns audio focus. Permanent loss clears sound intent; transient loss pauses and can resume through the freshness/recovery gate. Audio API's own Android focus observer is not enabled at startup. Actual call and route changes remain device acceptance cases.

The rendering graph owns continuously looping, cropped stereo buffers, smoothed rate changes and native scheduled gain automation. On every fresh control it holds then fades at the **remaining** RPM/stream lifetime; pedal fallback is also pre-scheduled. Interruptions set native gain to zero immediately before any paused native clock can resume. Continued real BLE-to-JS delivery in background is an outstanding gate. No foreground-only behavior is represented as accepted background support.

## Physical checklist

Use a locally bundled build as well as a development build connected to Metro. Record device, OS, BRZEE firmware revision, vehicle and chosen output route for each run.

- Discover by service UUID; choose correctly among multiple boards. Confirm the notify characteristic and immediate complete snapshot, then several minutes of streaming. Record notification/snapshot rate, sequence gaps, available pedal IDs and effective ages using development diagnostics.
- Verify all displayed units/signed values against firmware output. Confirm invalid/unavailable signals and repeated old samples stay honest.
- Exercise small MTUs where possible, congestion, board reboot, Bluetooth off, permission denial, cancellation, retry and reconnect. Confirm no old-session callback revives data or sound.
- Confirm the sound starts muted, persists with screen locked/backgrounded, and follows changing real RPM/pedal. A frozen loop with no control changes fails acceptance.
- Withhold JS controls for over a second. Capture native output: fade begins by the existing RPM/stream expiry and reaches silence about 200ms later. Expired pedal alone must move to moderate RPM-only load.
- Test a call, OS refusal to resume, manual mute during call, AUX removal/replug during call, and explicit re-enable. Old intent must not revive through interruption/reconnect.
- Measure telemetry-to-AUX response. No latency result exists yet. Listen to every loop and transition as described in `audio-calibration.md`; source-RPM hypotheses remain provisional.
- Learn a higher RPM ceiling with distinct samples, observe its one-second glide, relaunch to verify persistence, then reset. Demo must neither alter real learning nor connect to hardware.
- Android: verify runtime permissions, the ongoing notification and service types while muted/audible, focus loss, wired-route removal, lock/background, task removal and force-stop. Check a denied notification permission path.

Release acceptance remains pending until these real-device checks pass.
