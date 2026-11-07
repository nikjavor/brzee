# 911 GT3 RS recording audit

Run `node tools/analyze-sounds.mjs` to regenerate `audit.json`. Original WAVs are read only; the report records SHA-256, RIFF data offset, format, duration, RMS, peak, one-second level blocks, stable two-second candidate regions, stereo seam error, autocorrelation candidates, and spectral peaks. `afinfo` independently confirms stereo 44.1 kHz PCM16 and data offset **46**. All eight supplied filenames are preserved and bundled on both platforms.

These are **preliminary tuning hypotheses**, not verified source RPM or listening-certified loops. No human listening session has been recorded. The spectral peaks often form ambiguous harmonic families (approximately 41/125/250 Hz in several layers); interpreting one dominant as the firing fundamental can give the wrong octave/order. Autocorrelation constrained by layer names is especially weak for the high recordings and is not used as ground truth. The old Swift constants are not adopted as calibration.

| Layer | Reference rpm hypothesis | Evidence / uncertainty |
| --- | ---: | --- |
| Idle | 1,270 | 63.6 Hz component, assuming 3 firings/revolution; low confidence |
| On low | 2,500 | Correlation candidate 2,450; 250 Hz may be second firing harmonic |
| Off low | 2,465 | 123.25 Hz firing-frequency hypothesis; harmonic ambiguity |
| On mid | 5,000 | 250.12 Hz component with 41/125 Hz family; low confidence |
| Off mid | 5,000 | Shared approximately 124 Hz family; particularly uncertain |
| On high | 6,675 | 334.44 Hz firing-frequency hypothesis; could instead be a higher harmonic |
| Off high | 6,855 | 342.82 Hz firing-frequency hypothesis; 257.63 Hz alternative |
| On very high | 7,460 | 373.05 Hz firing-frequency hypothesis; 41/124 Hz family also present |

The initial usable profile range is 1,270–8,500 rpm, an engineering range covered by the declared rate windows, not a claim about the recording vehicle. In particular, off-high remains active at the upper end instead of pitching off-mid indefinitely or dropping all off-load sound. Loudness trim normalizes whole-recording RMS toward 0.18 before the mix's conservative headroom. These limits and reference values require adjustment after listening.

Raw seam RMS differences are significant (roughly 0.06–0.18), so raw hard-looping is unsuitable. The native preparation path must crop the selected regions and overlap their tail/head over 20 ms, then loop the resulting continuous buffer. It converts source frames to seconds before indexing a resampled decoded buffer. This processing is derived in memory and never modifies the recordings. Pitch changes intentionally change playback rate with pitch correction disabled.

## Listening acceptance (pending)

1. At low volume through headphones and then AUX, isolate each loop at rate 1 for at least 30 seconds. Check seam clicks, phasing, stereo stability, repeated transients, and changes through the loop.
2. Sweep every declared playback-rate interval. Confirm useful character and revise bounds where it becomes artificial. Confirm relative pitch by comparing overlapping layers; source RPM metadata or a measured reference is needed to resolve harmonic ambiguity.
3. Sweep the profile range at 0, 25, 50, and 100 percent load. Listen for loudness holes, abrupt timbre changes and on/off pitch mismatch. Pay special attention to mid/high and off-high coverage.
4. Compare recorded output waveforms during transitions, mute, expiry and profile reselect. Check peak headroom and click-free fades at the actual output sample rate.
5. On the real car, calibrate real idle/pedal while parked, test AUX removal, lock/background, calls and loss of telemetry. Measure input-to-AUX latency; none is currently promised.

The app's sound path can be exercised with this profile while this acceptance is pending. Acoustic realism is not yet accepted merely because the metadata validates or the native graph runs.
