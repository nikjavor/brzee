# Native dashboard captures

The normal app has no demo or fixture mode. `entry.tsx` is an alternate, test-only entry point that renders `AppShell` with a silent audio backend, no persistence and a protocol-v1 fixture transport. Its three stationary snapshots represent warm idle, city driving and highway cruising. The values are illustrative, not real car measurements.

Build the production iOS simulator Release app first (see the app README), then boot an iPhone simulator and run from `app/`:

```sh
python3 tools/capture-ios-screenshots.py \
  --app /tmp/brzee-production-build/Build/Products/Release-iphonesimulator/BRZEE.app \
  --device YOUR_BOOTED_SIMULATOR_UUID
```

The script copies the native app into a temporary folder and replaces only that copy's JavaScript with the screenshot entry. It captures PNGs into `docs/images/`, restores the untouched production build, captures its connection screen, and clears status-bar overrides. No real BLE radio is used and no audio is played. Do not distribute the temporary screenshot app.

`index.ts` imports only the production app. `tests/` and `tools/` are excluded from EAS uploads by `.easignore`.
