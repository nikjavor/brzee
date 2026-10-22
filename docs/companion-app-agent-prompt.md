Build the first version of the BRZEE mobile companion app in this repository. It must support iOS and Android, with initial development and physical-device testing focused on iOS. I will provide a hand-drawn sketch, the firmware's `ble-protocol.md`, and an existing 911 GT3 RS sound pack alongside this prompt.

Begin with discussion and planning only. We will clarify requirements, discuss the approach, and select useful agent skills. I will install skills after that discussion, before implementation starts. Until I explicitly tell you that the skills are installed and authorize you to start building, limit your work to reading existing files, researching, asking questions, and discussing recommendations. Do not create or modify project files, scaffold the app, install dependencies, write implementation code, or run builds. Finishing the discussion, agreeing on a plan, or detecting installed skills is not permission to start. When we are ready, summarize the agreed requirements, proposed architecture, selected skills, and remaining questions, then wait for my explicit go-ahead, such as “Skills are installed; start building.” All implementation instructions below apply only after that authorization. Once authorized, read the installed skills and applicable repository instructions before making changes.

The app connects to my BRZEE hardware, displays live car telemetry, and generates engine sound that responds to actual engine RPM and accelerator pedal position. Keep the first version simple, visually polished, and enjoyable to use. Sound response is a core feature of this version.

Read this prompt, the sketch, the supplied BLE specification, and any existing repository instructions before proposing the architecture. You do not have the previous conversation or necessarily have access to the firmware repository. Ask me about anything we have not established, and do not present assumptions as decisions I have already made. Group consequential questions into a concise first message, explain relevant tradeoffs, and continue only read-only investigation while awaiting my answers. After implementation is explicitly authorized, do not make me approve every routine implementation detail.

The intended app flow is:

1. Open a connection screen with BRZEE branding and a large central circular Connect control, as shown in the sketch. Tapping it starts device discovery and connection. Make scanning, connecting, waiting for telemetry, and errors understandable. Handle Bluetooth being off, denied permissions, no device found, and more than one matching device. Only present telemetry as live after a complete valid snapshot arrives; a Bluetooth connection alone does not mean car data is available.
2. After connection and subscription succeed, transition to the live dashboard. Preserve the sketch's central circular instrument concept: a prominent speed reading in km/h in the center; an F1-inspired segmented RPM gauge above the circle with a numeric RPM value; a coolant-temperature indicator on the left; accelerator pedal position on the right; and torque in Nm near the bottom. Add clear units and enough labeling that the indicators are understandable. Show connection and data freshness without clutter. Invalid readings should appear unavailable, such as `—`, rather than as invented numbers.
3. Put a sound-profile control below the instrument, as in the sketch. It should show the selected profile and open a simple selector. Start with the supplied 911 GT3 RS profile; the sketch's “Ferrari V8” is a placeholder. One working sound profile is enough for the initial version; keep the selector extensible without presenting unavailable profiles as playable. Include accessible sound enable/mute and volume controls; their placement is open to your design judgment. Establish the initial sound-on behavior with me.

Use the sketch as a layout and interaction reference. You may refine proportions, typography, colors, gauge geometry, transitions, and small details. Aim for a cohesive automotive instrument feel, readable numbers, smooth motion, and a small number of focused screens. Ask about aesthetic preferences that are not established, including theme and accent colors. Keep essential controls usable on real phones and respect safe areas, text scaling, and reduced-motion settings. RPM scale/redline and coolant indicator thresholds are not supplied by the current BLE protocol; ask about them rather than presenting arbitrary values as vehicle-specific facts.

The hardware and communication contract are already implemented:

- The controller is an ESP32-C6 that queries vehicle data using OBD-II Mode 01 over 11-bit classic CAN. The phone receives decoded telemetry over Bluetooth Low Energy. It does not talk directly to the vehicle's CAN bus or use an ELM327 text-command interface.
- The product is called BRZEE in this brief/sketch, but the current firmware advertises the exact name `BRZI`. Keep the branding separate from the discovery identifier and confirm the final visible spelling with me.
- BLE service UUID: `f023e430-7ac9-4f6d-a40a-5a43b9181a01`.
- Telemetry characteristic UUID: `f023e430-7ac9-4f6d-a40a-5a43b9181a02`.
- Discover by service UUID, connect, discover the notify-only characteristic, and enable its notifications. There is no application telemetry read/write command. Use the platform or BLE library's notification-subscription API; it must enable the standard CCCD (`2902`, notification value `01 00`) as appropriate.
- One phone can connect at a time. The current firmware has no pairing, bonding, or encryption requirement. Advertising resumes after disconnect. It sends a fresh complete snapshot immediately after subscription, then approximately every 100 ms.
- The preferred ATT MTU is 247. Where supported, request a suitable MTU on Android. Accept the actual negotiated capabilities on both platforms and support fragmented notifications. Do not require a particular MTU for correctness.
- BLE carries telemetry only. The app generates and plays sound on the phone through the chosen audio output. The firmware has no audio-upload, audio-playback, or vehicle-control command.

Use the supplied `ble-protocol.md` as the authoritative version 1 contract. Preserve it in the app repository as an integration reference. Its full signal table, framing rules, and receiver contract matter even though the dashboard only displays a subset. Implement decoding for all 35 records and expose a typed model containing raw signed integer values, validity, and sample age.

The essential byte layout is:

- All multibyte values are little-endian, with no padding.
- Every notification begins with a 5-byte header: version (`uint8`, currently `1`), snapshot sequence (`uint16`), fragment index (`uint8`, zero-based), and fragment count (`uint8`). The rest is a slice of the snapshot body.
- Assemble fragment payloads before parsing records. The complete body is exactly 219 bytes: controller capture uptime (`uint32` milliseconds), a 5-byte validity bitmap, and 35 fixed-order records of 6 bytes each.
- For signal ID `id`, the value is a signed `int32` at body offset `9 + 6 * id`. Its age is a `uint16` in milliseconds at offset `13 + 6 * id`. Validity is bit `id % 8` of body byte `4 + floor(id / 8)`. Unused validity bits 35–39 must be zero.
- MTU 247 or higher produces one 224-byte notification, including the header. MTU 185 produces two fragments; MTU 23 produces fifteen. A record can cross a fragment boundary.
- Sequence gaps are expected when the firmware drops a snapshot under congestion. Sequences wrap at 65535 and may restart on reboot. Use the specification's modular sequence comparison, ordered-fragment validation, and history-reset rules. Reject unknown versions and malformed assemblies; never publish a partial snapshot.
- Replace the live snapshot atomically after successful assembly and validation. Attach the phone's monotonic receipt time. Controller capture time is uptime, not UTC, and wraps at 32 bits.
- Between snapshots, effective sample age is transmitted age plus elapsed local monotonic time. A transmitted age of 65535 means at least 65.535 seconds old. Receiving the same old sample in a new snapshot does not make that sample fresh.
- Mark the stream stale after one second without a complete snapshot and disconnected immediately on disconnect. Clear assembly/sequence state on reconnect and apply the specification's reset after one second without any notification. These are separate timers: incomplete notifications must not keep the live dashboard fresh.

These signals are especially relevant to the first version; all IDs below are BLE record IDs, not OBD PID numbers:

| BLE ID | Meaning | Unit |
| --- | --- | --- |
| 0 | Engine RPM | rpm |
| 1 | Vehicle speed | km/h |
| 2 | Coolant temperature | °C, signed |
| 3 | Throttle position | % |
| 16 | Accelerator pedal position D | % |
| 17 | Accelerator pedal position E | % |
| 18 | Accelerator pedal position F | % |
| 19 | Relative accelerator pedal position | % |
| 34 | Derived actual engine torque | Nm, signed |

Accelerator pedal position and engine throttle position are different measurements. Do not silently substitute throttle position for pedal position or label them interchangeably. Pedal D/E/F identify accelerator sensor channels; they are not different physical pedals. Absolute sensor readings may not cover 0–100% of physical pedal travel. Ask how we should choose the pedal source, whether calibration is needed for my car, and what fallback behavior I want if no suitable pedal signal is available. Keep source selection consistent between the dashboard and audio engine.

Signal availability depends on the car. An invalid bit means unavailable; version 1 cannot tell the app whether the cause is an unsupported PID, no response yet, or a failed query. Do not claim a specific cause from that bit alone. The torque reading is the firmware's estimate from actual torque percentage and reference torque; it may be absent or negative. Use ID 34 for Nm, not the percentage records.

Streaming at about 10 snapshots per second does not mean every signal was freshly measured at 10 Hz. Firmware minimum polling intervals are approximately 100 ms for RPM, 200 ms for speed, 250 ms for pedal D and relative pedal, 500 ms for throttle position, and 1 second for coolant and actual torque percentage. Other pedal channels are polled at 1 second. ECU response time, scheduling, and failures can make updates slower. Handle validity and individual sample ages as well as whole-stream freshness. Agree sensible per-signal freshness thresholds for sound with me; interpolation must not disguise a lost or stale input.

For sound, the intended behavior is continuous engine audio whose pitch/character follows RPM and whose intensity/load character responds to accelerator input. Assess the supplied sample pack and ask what level of realism I expect before committing to the audio architecture. Avoid restarting a short sound on each BLE update. Keep audio rendering independent of UI redraws, interpolate control changes smoothly, and avoid clicks or abrupt changes during profile switching. Define behavior for zero RPM, invalid or stale RPM/pedal readings, disconnects, audio interruptions, and output-route changes. When required telemetry is lost, fade out rather than continuing indefinitely from the last values. Agree the precise fallback policy with me.

I can provide the 911 GT3 RS samples from `../brzee-app-old/modules/engine-audio/ios/Sounds` (that path is relative to the firmware repository). Locate the supplied folder or copy in your environment; ask me if it is not accessible. The eight existing files are stereo, 44.1 kHz, 16-bit WAVs. Preserve their actual filenames, which use the prefix `911_GT3R_`:

```text
911_GT3R_idle.wav
911_GT3R_onlow_1.wav
911_GT3R_onmid_2.wav
911_GT3R_onhigh_1.wav
911_GT3R_onveryhigh_1.wav
911_GT3R_offlow_1.wav
911_GT3R_offmid_1.wav
911_GT3R_offhigh_1.wav
```

The old iOS code treats these as idle, four on-throttle RPM layers, and three off-throttle RPM layers. Evaluate continuous looping, pitch adjustment, RPM-dependent crossfades, and pedal-dependent blending using these assets. Validate their actual loop boundaries, tuning/reference RPMs, loudness, and useful playback-rate ranges; neither filenames nor old constants establish correct calibration. Some clips are over 30 seconds long, so do not assume each entire file is a short, steady, seamless loop. Ask how the real car's RPM range should map to the sound profile's range instead of assuming the test car is itself a GT3 RS.

The old module also has `ios/EngineSound.swift`, `ios/LoopPlayer.swift`, and `ios/EngineAudioModule.swift` beside the sound folder. They are optional references for how the samples were previously loaded and blended. Their parameters and behavior are not approved requirements for the new app, and that Swift implementation does not establish Android support. Keep the old repository and original recordings unchanged. After implementation is authorized, package the supplied assets appropriately for both platforms in the new app repository. Their current location under `ios/Sounds` is an old project layout, not a requirement to make the sound feature iOS-only.

Resolve these open decisions early, combining related questions where helpful:

- Preferred framework, if any, and any existing code or constraints in this repository. Recommend an approach after considering physical iOS BLE testing, continuous responsive audio, and Android support. Verify current official platform/library documentation before relying on specific capabilities. Do not assume the stock development client supports the required native modules.
- My initial iPhone/iOS version, test vehicle, available hardware, and whether you can access the protocol attachment and any useful firmware fixtures.
- Desired realism, sample calibration/loop points, and mapping real vehicle RPM/pedal input to the supplied 911 GT3 RS sound profile. The first pack is already available; ask about any missing metadata or additional assets only when needed. Discuss a synthesized fallback only if the supplied samples leave a concrete gap.
- Expected audio output: phone speaker, wired connection, car Bluetooth, or another route. Discuss and measure latency for the intended route rather than promising responsiveness without testing.
- Whether audio/BLE must continue with the screen locked or the app in the background; desired behavior with silent mode, music, calls, and interruptions. Do not assume background operation is included or unnecessary.
- Pedal source/fallback/calibration, gauge ranges, units, visual preferences, final branding, and sound start/mute behavior.

Keep the implementation focused. Separate BLE transport, fragment assembly/decoding, telemetry state and freshness, audio rendering, and UI so each can be developed and verified independently. Avoid adding accounts, cloud services, trips, maps, or unrelated features unless I request them. If development needs mock data, provide a clearly labeled demo/replay mode that exercises the same downstream model and cannot be confused with a live connection.

Start with a concise set of questions, a proposed implementation plan, and relevant skill recommendations conditional on the agreed stack. Complete the discussion and wait for my explicit authorization after skill installation. Once authorized, build a working vertical slice: connect to hardware, receive and decode real snapshots, show the dashboard, and drive an initial audio profile from real RPM and pedal data. Implement BLE, dashboard, and audio support for both iOS and Android, prioritizing physical iOS testing. Provide setup and run instructions for both platforms. Add meaningful tests for byte decoding, fragmentation, sequence/timer behavior, invalid and signed values, and stale-input audio behavior. Verify the app builds on the platforms available to you and report what was actually tested, including any environment blockers or remaining device checks. Firmware documentation reports host/build verification but leaves physical phone/radio acceptance open; do not assume the integration already works on a device.

The first version is successful when I can run it on my iPhone, connect to BRZEE, see honest live readings in a polished version of the supplied design, hear continuous engine sound responding to RPM and accelerator input, choose among the agreed available profiles, and recover cleanly from missing data and disconnections. Android compatibility is also required; distinguish implemented support from behavior that still needs physical Android testing.
