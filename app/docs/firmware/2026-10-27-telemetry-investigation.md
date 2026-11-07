# BRZEE telemetry investigation — 2026-10-27

Status: approved by the user on 2026-10-27, applied to the original firmware checkout, and flashed to the connected BRZEE. Flash checksum and running version are verified; on 2026-10-28 the owner confirmed stable live use after installing app build 2. The user subsequently requested an app-side grace period for short gaps, described below. The installed app can consume this candidate's unchanged version-1 BLE wire format.

## Observed on the connected hardware

The user reports repeated brief RPM/speed blanks and sound waiting for fresh RPM while the transport indicator remains LIVE; pedal readings advance slowly. BRZEE 1.0.0 is installed on the paired iPhone 17. BRZEE's serial startup identifies firmware version `da0b447`, matching the local firmware checkout.

A 20-second serial capture contains 15 failed RPM queries, 12 failed speed queries, 15 failed pedal-D queries and 1 failed pedal-E query. These counts include the startup period. The existing scheduler immediately invalidates a signal after each failed query, so fresh BLE snapshots can contain unavailable RPM/speed even while notifications continue. The app correctly obeys those validity bits.

Pedal E/F are scheduled at 1,000 ms in this firmware. D and relative pedal are 250 ms. Repeated failed queries for never-responding channels also consume the shared serial requester. Oldest-deadline scheduling lets overdue auxiliary polls delay RPM.

Opening the USB serial port unexpectedly triggered a USB_UART_HPSYS board reset despite DTR/RTS being disabled before opening. The port was closed after the capture and was not reopened. No CAN commands, flash operations, or explicit reset commands were sent by the capture script. The trace is retained locally at `/tmp/brzee-live-2026-10-27-serial.log`.

## Proposed firmware changes

- Keep the latest successful value and its original timestamp across a transient query failure. Never manufacture a first value or refresh a sample's age on failure. Explicitly unsupported values remain invalid. The app still expires retained samples by their original age; fresh snapshots do not renew an old sample. Current app tolerances are listed below.
- Poll E/F at 250 ms in the same fast class as D/relative pedal.
- Give due RPM/speed/pedal jobs priority over auxiliary jobs, with oldest-deadline fairness inside the fast class and among auxiliaries.
- Back off never-responding probes exponentially, capped at 10 seconds or the original interval if longer. Previously measured channels retain their configured retry interval. This reduces wasted queries after a partial PID support scan.

No acquisition timeout increase, artificial display values, interpolation over missing data, BLE format change, or app timeout relaxation is included.

## Verification

The original firmware host suite passed before changes. Each new regression was observed failing against the corresponding old behavior and passing after its fix:

1. A failed RPM query used to invalidate a 1,000 rpm sample. It now remains available with its original 1,000 ms timestamp at local 1,160 ms. A signal with no first success stays invalid.
2. E/F each made fewer than 8 requests over 3 seconds under the old schedule; both now meet the tested update bound of 350 ms in the immediate-response fixture. This verifies scheduling, not actual ECU throughput.
3. With all auxiliary queries timing out, maximum simulated RPM request gap fell from 1,510 ms to 190 ms. The invariant leaves room below the app's 500 ms expiry.
4. A never-responding F channel was probed 15 times in 10 seconds after promoting it without backoff; the completed candidate makes 5 attempts, keeps it invalid and continues frequent RPM updates.
5. A 30-second reference-torque poll never retries sooner than its original interval, including when the generic backoff cap is smaller.

Production C scheduler/OBD/car-data code ran under address and undefined-behavior sanitizers. The existing decoder/discovery/derived-value and BLE fragmentation/sequence/congestion suites passed. The app's 104 tests also passed; they already enforce expiry of repeatedly transmitted old samples. The initial post-flash capture had no successful ECU readings; a later physical screenshot and the owner confirmation below establish subsequent live operation.

The installed ESP-IDF 6.1 toolchain completed an ESP32-C6 build. Candidate version: `da0b447-telemetry1`. Binary size: 607,632 bytes; 42% of the 1 MiB app partition remains free.

## Artifacts and applying

[Reviewable patch](2026-10-27-brzee-telemetry.patch) changes the scheduler, adds host regressions and clarifies cached-sample semantics in the firmware's protocol document. Before application, `git apply --check --whitespace=error` succeeded against `/Users/nikjavor/repos/brzee`, including its existing untracked host-test file. The approved patch is now applied. The existing editor-settings modification and unrelated untracked prompt remain as they were.

The source used for the native build is `/tmp/brzee-telemetry-firmware-20261027`. Locally retained binaries and a manifest are in `build/firmware/2026-10-27/` in the app worktree. The candidate has SHA256 `f330d2484196866f3d4f11b949e8dd9c59bab448657fa18c833c9de3027d29cf`. A copy of the original build binary is retained beside it for rollback; its embedded ELF hash matches the captured running image prefix `03b27514f`.

## Approved application and flash

The user explicitly approved applying and flashing this candidate. The patched original sources match the compiled temporary source files, and the host tests passed again after application. Esptool wrote only the application image at `0x10000`; its readback hash verification passed. Bootloader, partition table and NVS were not written. The original build image remains available for rollback.

The 30-second post-flash serial capture confirms `da0b447-telemetry1` booting and the phone reconnecting at about 1.9 seconds. BLE notifications continued, but all 25 logged RPM, speed, D and E summaries were unavailable. The passive bitrate probe observed 30 frames at 500 kbit/s, versus 3,082 before the update; this measurement occurs before the modified scheduler starts. No successful ECU sample was obtained during this check, so this is not evidence that the original dropouts are fixed on the car. The user subsequently confirmed ignition on/OBD connected and reported fewer but remaining dropouts; the app-side update below addresses their request for more tolerance.

Flash log: `/tmp/brzee-telemetry-flash-20261027.log`. Post-flash startup/telemetry log: `/tmp/brzee-live-after-2026-10-27-serial.log`. The local candidate manifest records flash verification and running-version confirmation. The owner subsequently confirmed live stability with build 2. Genuine stale-input expiry is covered by host/native automation tests; broader physical acceptance remains separate.


## App-side tolerance requested after flashing

The owner reports the firmware change reduced but did not eliminate the dropouts, and confirmed ignition on/OBD connected. They requested that the app be less strict about short lost updates. App build 2 uses 1,500 ms for RPM and D/relative pedal, 2,500 ms for speed, and retains 2,000 ms for E/F. Complete-stream expiry remains 1,000 ms; recovery no longer interrupts playback for a sub-second controller/packet delay. Both UI selection and native expiry use the same signal limits. Learning evidence remains strict.

Three new regressions failed against the original app policy and passed after the change: late valid RPM continues through its bounded grace period without renewing its deadline; brief controller/packet delays do not unnecessarily restart recovery; and RPM/speed/pedal survive short sample gaps while expiring at their hard limits. Existing boundary fixtures were updated to the new policy. All 107 host tests, strict typecheck and lint pass. The signed standalone Release build succeeded, and build 2 was installed and launched on the paired iPhone. Device inspection confirms version 1.0.0/build 2, with a bundled main.jsbundle. On 2026-10-28, the owner answered “Stable now” when asked about remaining dropouts and pedal smoothness after installing build 2. Build/install logs: `/tmp/brzee-iphone-gap-grace-build.log`, `/tmp/brzee-iphone-gap-grace-install.log`, `/tmp/brzee-iphone-gap-grace-version.log`.


A read-only physical screenshot after installing build 2 shows the non-Demo dashboard with RPM 1,366, speed 9 km/h, pedal 25%, estimated torque 46 Nm and “Pedal-responsive sound.” This establishes that the updated app is receiving and displaying real telemetry at that instant; it does not establish uninterrupted playback over time. The owner subsequently confirmed “Stable now” on 2026-10-28. Screenshot: `/tmp/brzee-iphone-build2-check.png`.


## Owner confirmation — 2026-10-28

After the approved firmware update and installation of standalone iPhone build 2, the owner answered “Stable now” to the live-use validation question about brief dropouts and pedal response. The reported stability issue is resolved in the owner’s current test. This confirmation does not specify a test duration or establish the remaining background, call/route, acoustic-calibration or physical Android acceptance cases.
