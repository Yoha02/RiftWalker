# Rift Walker submission

Status: MLH draft saved; final submission blocked by required repository and demo-video links.

Source repository: https://github.com/Yoha02/RiftWalker

## Project name

Rift Walker

## Short pitch

Your world is the inventory: borrow powers from everyday objects to cross a broken world and battle a boss in your camera feed.

## Description

Rift Walker combines a short platforming adventure with a camera-backed boss encounter. In The Broken Reach, a small hero crosses floating islands using spectral bridges borrowed from the shapes of real objects. A notebook or ruler can represent a bridge; a broad surface can become a shield; a shiny object can unlock reflection; an elongated prop can unlock a stronger fantasy strike.

At the portal, the adventure becomes Reality Raid. The Rift Warden appears over the player's live camera backdrop. Players read attack warnings, defend against orb volleys and beams, then counterattack while the boss's core is exposed. The encounter includes a faster second phase, retries and a victory state.

The implementation separates responsive play from AI judgments. MediaPipe hand tracking runs locally for movement, pinch-to-jump, open-palm guarding and swipe attacks. The Gemini Decisions API integration evaluates a captured image against fixed visibility and object-property criteria. Deterministic game rules decide whether an ability unlocks, where bridges appear and how combat resolves. Hydrogen supplies optional cosmetic object names and descriptions.

The current deliverable is a local prototype with one traversal level and one boss. Keyboard controls and explicitly labelled practice items support playing without an API key. A standalone HTML edition avoids the need for a local server. The boss uses camera compositing rather than room-mapped AR.

## Built with

JavaScript ES modules, HTML, CSS, Canvas 2D, Node.js, browser MediaDevices, MediaPipe Hand Landmarker, Gemini Decisions API integration and Gemini Hydrogen integration.

## Implementation and validation disclosure

- 19 automated tests pass, covering deterministic gameplay, decision-response validation and simulated camera lifecycle checks.
- UI source checks found no missing or duplicate element IDs across 61 referenced controls/elements.
- Live external-camera operation, visual playthrough and successful Gemini API calls have not yet been verified. Browser-control and localhost-access restrictions prevented those checks in the development session.
- Practice selections are manual test inputs and are labelled; they are not presented as successful AI recognition.
- AI assistance: ChatGPT/Codex assisted with design, code, tests and documentation.

## Links to complete

- Source repository: not supplied yet.
- Demo video: omitted at the user's request; intended for a later update if the event permits it.
- Hosted demo: none. Localhost is not a public demo URL.

## Prize-category plan

- Best Overall Hack: intended category.
- Cleanest Use of a Software Factory: intended category; specification, deterministic tests and explicit model contracts are included as development evidence.
- Best Use of System One Models: intended target, but the Decisions API integration still requires live validation. Do not describe model results as verified.
- Best Demo Video Using HyperFrames: no entry evidence yet; no HyperFrames video has been produced.

## Submission constraints

The earlier observed form marked source repository and demo video links as required. Current form validation and permission to edit after submission have not been reverified. Do not use a placeholder video URL or claim a final submission was accepted. If the form requires a video, save a draft if offered and obtain a real video before final submission.
