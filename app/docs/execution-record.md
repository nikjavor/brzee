> Historical implementation record. The 2026-11-07 update removes Demo from the shipped app; see [current release verification](production-readiness.md).

# Execution record — 2026-10-22

The user authorized direct execution of the ten-task BRZEE plan. All ten software tasks were committed on `codex/brzee-v1`, isolated from `main`. Physical testing was explicitly deferred. See [verification](verification.md) for tested scope and remaining gates.

A fresh independent review reported no Critical issues, three Important issues and one Minor. The Important issues were fixed in one pass with observed failing regressions followed by green suites: native interruption restart (including failure reporting), abandoned-focus interruption reconciliation and equal-power mixing. No second review was dispatched after the fixes. The original review attempt returned no findings because of a model usage limit; its available-model replacement performed the whole read-only review.

## Rulings in execution order

1. the repository was unborn and all supplied files were untracked, so establish a baseline commit containing the supplied assets/docs/skills and an ignore policy before creating the plan-authorized isolated worktree — required by Git/workflow helpers; cost if wrong is an extra reversible local baseline commit.
2. run platform-independent Task 2 tests while initial native builds download/compile dependencies — these tests have no native coupling; cost if wrong is re-running host verification after compatibility resolution.
3. ship an explicitly provisional playable profile while exact source RPM and listening validation remain pending — spectra have ambiguous harmonic families and no trusted source metadata exists; cost if wrong is retuning references/loops before acoustic acceptance, not treating the initial constants as calibrated facts.
4. add a small local Expo Android session service — inspection of Audio API0.13.6 shows active foreground types only mediaPlayback/microphone, never connectedDevice, so its notification alone cannot represent muted BLE work; cost if wrong is maintenance of a small platform adapter.
5. local Android adapter also owns audio focus and wired/USB route removal — Audio API0.13.6 emits no Android route changes and collapses permanent/transient focus loss, which can leave manual enable stuck; cost if wrong is additional native adapter maintenance and still-pending real route/call acceptance.
6. real BRZEE/AUX/locked-screen/calls/Android connected-device service acceptance set aside by reviewer — keep physical acceptance pending because the user explicitly deferred hardware testing; simulator results establish only their stated scope — cost if wrong is physical failures discovered during later device acceptance.
7. exact source RPMs/loop realism/latency set aside by reviewer — keep profile provisional and measurements pending under the original acoustic ruling; no tuned realism or latency claim — cost if wrong is retuning references/loops and revisiting the blend after listening.
8. music mixing with other apps set aside by reviewer — retain optional configuration but leave music coexistence unaccepted, as agreed — cost if wrong is extra platform policy work if music becomes required.
9. automatic vehicle identity/named profiles/store/cloud distribution set aside by reviewer — retain the agreed local single-current-vehicle scope with explicit reset — cost if wrong is later feature and distribution work.
10. known tooling advisories set aside by reviewer — retain documented unresolved advisories; independent review is not exploitability or patched-version evidence — cost if wrong is affected build inputs/tooling and dependency remediation before distribution.

## Deferred minors

- Route removal during asynchronous sound preparation can leave the status saying Preparing your sound; Enable remains pressable. src/app/DriveRuntime.ts preparation generation return.
