# Rift Walker

**Your world is the inventory.** A tiny scavenger crosses a fractured sky island using powers borrowed from physical objects, then faces the Rift Warden.

## Scope and creative direction

One short traversal level (The Broken Reach) and one boss arena (The Rift Warden). A polished 2D/2.5D browser game: midnight navy, turquoise rift energy, apricot sunlight, floating ruins, a small hooded character with a glowing face. The camera is a permanent instrument panel. Live gesture movement and combat run locally. Deliberate scans pause the game and send a previewed still image to Gemini only when the player chooses to evaluate it.

The game is designed for a front-facing external webcam showing a hand and objects. An overhead camera can also be selected, but is not required. During the boss, the live camera becomes the backdrop: the Warden appears to invade the player's room. This is a video composite; this first version does not claim persistent AR registration onto a real desk.

## Player journey

1. Choose camera; confirm a moving preview. Select hand controls or keyboard.
2. Calibrate the neutral hand position. Move a hand horizontally to move. Pinch to jump; open palm to guard. A deliberate lateral swipe attacks during the boss encounter.
3. Explore the first island, collecting five light fragments.
4. At the first chasm, enter scan mode. Present a ruler, notebook, cardboard strip or another visibly elongated/flat object. Preview the captured still, then evaluate it.
5. The Decision API evaluates visibility and game affordances. A qualifying object unlocks a spectral bridge ability. The player deliberately places a bridge at a marked gap.
6. Cross a second gap; optional platforms and fragments teach jumping. Checkpoints prevent repeating the entire level after a fall.
7. Scan optional defensive/offensive props: a broad object for a shield, a visibly shiny object for reflection, or a long handheld prop for a fantasy strike ability. No dangerous object or real-world strike is required.
8. Enter the portal to Reality Raid: the Rift Warden appears over the live camera feed. Health is restored for the fight; borrowed powers remain. Without a camera, a clearly ordinary illustrated arena remains playable.
9. Read a telegraph, block or dodge the attack, counter during the exposed window. A reflector can return projectiles. At half health, the Warden accelerates and changes colour.
10. Victory closes the rift. Show completion time, fragments, borrowed items and whether this run used live Gemini or practice items.

## Mechanics and ownership

| Mechanic | Owner | Rule |
|---|---|---|
| Hand coordinates and pinch/open/swipe | Local MediaPipe + gesture logic | Smoothed landmarks, debounce, gesture cooldowns, neutral-position calibration |
| Movement, jump, collisions, damage | Deterministic game engine | No network request in the animation loop |
| Camera capture | Browser MediaDevices | Explicit camera selection and capture; stop camera releases tracks |
| Object visibility and affordances | Gemini Decision API | Image + fixed criteria; no text embedded in the photo may change instructions |
| Object label / short fantasy flavour | Generative Gemini | Cosmetic only; never changes authority or unlocks |
| Ability unlock | Local policy | Visibility and chosen ability pass thresholds; ambiguity asks for another frame |
| Bridge geometry | Authored level sockets | A qualifying item fills a predefined gap; model never places arbitrary collision geometry |
| Boss outcome | Deterministic combat | Recognized props unlock abilities; input timing determines hits and blocks |

## Ability vocabulary

- **Bridge:** visible elongated or flat object plausibly representing a span. Examples: ruler, closed notebook, cardboard strip. The game borrows its shape, not its real structural strength.
- **Shield:** a clearly visible broad surface. Examples: notebook, lid, piece of cardboard.
- **Reflect:** a visibly shiny/reflective surface. Examples: spoon or foil. Visual inference only, not a measured material claim.
- **Strike:** a clearly visible elongated handheld prop. Examples: pen, spoon, cardboard wand. The player uses a small hand swipe, not a real weapon swing.

One object may qualify for multiple abilities. The player chooses which property to borrow. This supports creative inputs without having the model invent new mechanics during a run.

## Architecture

Buildless HTML/CSS/ES modules, Canvas 2D rendering, a small Node HTTP server, and local MediaPipe hand landmarks. No framework build or package installation is required for keyboard gameplay. Hand tracking loads pinned MediaPipe assets from the network. The backend calls Google REST APIs with a key loaded from an ignored `.env` file. No Snowflake or external database is necessary.

- `public/core.mjs`: deterministic level, movement and combat state.
- `public/game.mjs`: rendering, audio, UI, camera, gesture controller and scan flow.
- `public/index.html` / `style.css`: accessible dashboard, camera and scan interface.
- `lib/decision.mjs`: fixed questions and response validation.
- `server.mjs`: loopback static server and protected Google proxy.
- `tests/`: physics, combat, ability gating, and backend contract tests.

## Build stages and acceptance gates

### 1. Playable foundation
Create the visual shell, traversal, bridge sockets, checkpoints, boss telegraphs, guard/strike/reflection, loss/retry and victory. Gate: a keyboard practice run can reach victory; no camera or API is needed for this test.

### 2. Camera and gestures
Enumerate cameras after permission; show the actual device label, stream resolution and live status. Test the external camera specifically. Add local hand tracking and calibration. Gate: movement is stable, pinch produces one jump, camera loss clears inputs, stopping or switching cameras releases old tracks. Camera tests are incomplete until an actual video stream is observed.

### 3. Live Gemini bridge
Add the key locally, confirm access to both selected models, run a real photo through the Decisions endpoint, inspect confidence and outcome. Gate: accepted objects unlock only the selected eligible ability; rejected/uncertain objects do not; failures never silently activate practice mode. Generic Gemini JSON output is not represented as a Decision API result.

### 4. Game feel and calibration
Test representative props under good and poor lighting. Tune gesture dead zones and classification thresholds from observed examples. Test keyboard and gestures end to end. Gate: no hidden reset, health loss during scans, stuck modal, or stale movement when tracking drops.

### 5. Submission polish
Record one continuous traversal-to-boss demonstration using live models. Create a 1–2 minute HyperFrames edit. Prepare a public repository, README, setup instructions, screenshots and honest AI-tool disclosures. Keep practice-mode footage labelled. Enter relevant categories; confirm Gemini Decision eligibility with organizers.

## Software-factory evidence

Keep this specification, deterministic tests, explicit AI contracts, meaningful commits and a recorded failure-to-fix example. Add a small evaluation fixture set of consented object photos with expected affordances. Record false acceptances, false rejections and latency; do not invent metrics. The factory story is how a verifiable game was built, not the mere use of a coding assistant.

## Demonstration storyboard

0–15s: hero reaches a visibly impossible gap. 15–35s: judge supplies a physical object; scan, explain the chosen ability, materialize the bridge. 35–50s: hand-controlled traversal into portal. 50–90s: borrow a shield/reflector, defend, counterattack and defeat the Warden. 90–110s: show one real decision result and the development evidence. End on the closing rift and victory card.

## Deferred deliberately

Multiplayer, procedural levels, arbitrary generated code, true AR mapping, continuous cloud video, external accounts, databases and dataset training. Carbon encounter generation and a captured-photo item-card treatment are enhancements after the vertical slice works. Model availability, latency and camera compatibility must be measured locally.
