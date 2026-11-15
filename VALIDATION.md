# Version 0.4 validation - 2026-11-14

- 49 automated tests passed, including synthetic motion for a book and thin pen without hand landmarks, camera-pan and lighting rejection, swipe arming/cooldown/reset, detector geometry validation, crop/mirror mapping, foreground compositing order, bounded uncertainty grace and simultaneous shield/strike.
- The first-person renderer and UI were inspected through the connected Chrome browser at localhost:4175. Showcase and practice equipment controls worked. J changed boss health to 96.6667% and produced a visible slash and damage number.
- Real-camera object localization has NOT been validated against the new backend: the user's desktop server was still version 0.3 during these checks and needs one restart. Tests cannot establish real-camera recognition or tracking accuracy.
- Model geometry is approximate and never authorizes gameplay powers. The Decision API remains authoritative.

---

## Latest status: first-person raid and live items

37 tests pass. Browser inspection verified advancing USB camera video at 1280 x 720, the perspective boss over that video, and a keyboard strike reducing the boss bar to 96.6667%, with no captured console errors. The test camera was stopped afterward. A separate preview tab preserved the user's existing run.

The updated multi-power recognition endpoint needs a server restart and a real-object playthrough. The UI detects an old server. Older entries below are historical notes.

# Verification status — 13 November 2026

## Confirmed locally

- All 19 automated tests pass: four camera-lifecycle tests plus ability criteria and response validation, bridge gating and collision support, checkpoints, jump debounce, traversal into the boss, damage, blocking, reflection, victory and retry. Camera tests use controlled video stubs and do not establish hardware access.
- Node starts the loopback server and reports `http://127.0.0.1:4173`.
- The current run reports Gemini is not configured. No real model inference has been claimed or fabricated.

## Still requires a browser/device pass

`PLAY-RIFTMENDER.html` is now a standalone practice edition bundling the HTML, CSS and local JavaScript. Its embedded JavaScript passes Node's syntax check and it has no external script tags or local module imports. Optional hand tracking still imports MediaPipe over the network. This edition has not been visually or physically camera-tested. It avoids the failed loopback-server dependency; it does not repair the assistant's unavailable browser-control connection.

- Visual inspection and a complete manual playthrough.
- External camera selection, moving preview, exact device label and resolution.
- MediaPipe loading, gesture calibration and performance on this device.
- Boss camera compositing with the external camera active.
- Real Gemini Decision responses and generative naming with the user's key and account access.
- Recognition acceptance/rejection rates and real inference latency.

## Why these checks are incomplete

The user subsequently supplied a Chrome screenshot showing `ERR_CONNECTION_TIMED_OUT` at the local URL. This establishes that the page was not reachable in that attempt. Another server launch did not remain available across tool calls, and a direct HTTP probe returned a socket-access denial. Use `START-RIFTMENDER.cmd` from the user's normal desktop session and verify the page loads before proceeding with camera tests. The earlier startup message alone did not establish reachability.

The computer-control tool returned `failed to launch codex app-server: program not found`. The app's preview-opening tool also failed. A shell HTTP smoke test was blocked by the environment with `connect EACCES 127.0.0.1:4173`; this prevents treating a server startup message as a successful browser response. These are verification limits, not evidence that the camera is missing or that the game fails to serve in the user's Chrome.

On the subsequent retry, the browser runtime initialized but returned `Browser is not available: chrome`. Windows Camera control still failed with the app-server error. Browser diagnostics encountered restricted process/profile visibility, so they cannot establish the user's actual extension state. The hardware gate remains open. The in-game connection flow now requires advancing video before displaying VERIFIED; stop/switch invalidates pending checks.

## Next manual verification

1. Run `npm start` from this folder if the server is no longer running. Open `http://127.0.0.1:4173` in Chrome.
2. Choose Connect camera, grant camera access, select the external device and verify its moving preview and label. Stop and reconnect it once.
3. Enter the rift. Expand Practice without Gemini and select Notebook. Move with A/D, jump with Space, and use E near each gap to create the bridge. Practice runs must retain their Practice label.
4. Select the practice shield, reflector and strike items. Enter the portal; verify the live room appears behind the boss. Hold K to guard and press J during exposed windows. Reach victory, then restart and confirm the inventory resets.
5. Enable Hand controls, hold a clearly visible palm, choose Center hand, and test movement, pinch, open-palm guard and swipe. Move the hand out of frame and confirm input clears.
6. Add the Gemini key to `.env`, restart, and use a new run. Capture and explicitly evaluate a notebook for bridge. Apply only an accepted result. Check a blank/obscured frame does not grant a power.
7. Compare notebook/cardboard, spoon/foil and pen under the actual demo lighting. Record measured probabilities, confidence and latency; adjust thresholds only from observed evidence.
8. Export a run log and record the final demo. Keep camera photos and `.env` out of the public repository.

No public repository, remote deployment, hackathon submission or demo video has been created yet.

## Hand-control repair

Tracker startup now shares a pending load across off/on toggles, ignores stale completions, and retries GPU inference failures using CPU. Errors are displayed in the tracking status. Detection confidence uses 0.5 and gesture distances account for camera aspect ratio. All 23 automated tests pass, including four new loader/recovery regressions; the rebuilt standalone script passes syntax validation. These checks do not verify live camera recognition. The browser controller blocks local-file inspection, so the user must reopen the updated standalone and report its tracking status. The Downloads copy is not automatically updated.

## User device feedback

The user reported that controls work after the hand-tracker repair. This is user-reported hardware feedback, not an assistant-observed camera test. Gemini inference and a full visual boss playthrough are still unverified. An MLH submission draft is saved; final competition entry has not been confirmed.

## Automatic Worldweave

All 30 tests pass. Seven new regressions cover accepted/rejected detections, request overlap and cooldown, cancellation, stale gap results, expired responses, billing errors and waiting at/releasing from an edge. Browser inspection at port 4175 confirmed the new controls, objective, toggle behavior and no captured console errors. The original user tab was in the boss encounter with a verified USB camera and hand tracking; a separate tab was used for UI inspection. Live automatic recognition latency and the new phone criterion still require a real object test after server restart.
