# Gemini integration notes

Verified against Google's online documentation on 13 November 2026. Documentation verification is separate from testing account access with a real key.

## Decisions: object properties

Official source: https://aistudio.google.com/docs/decisions-api

The existing server uses POST `https://generativelanguage.googleapis.com/v1beta/decisions` with `x-goog-api-key`. The model is `gemini-decision-1`. Shared input contains text and a base64 image block with `type`, `data`, `mime_type`, and `resolution`. Five independent `noul` questions test object visibility and bridge, shield, reflect and strike affordances. Each question includes its full criterion: questions cannot see one another.

Each answer supplies a probability of yes and confidence. In the documentation, binary confidence is the larger of the yes and no probabilities; high confidence by itself does not mean yes. Our game requires a positive probability above its threshold. Thresholds still need calibration with actual object photos. No free-form model output controls movement, physics or damage.

## Hydrogen: cosmetic names

Official sources:

- https://aistudio.google.com/docs/models
- https://aistudio.google.com/docs/image-understanding
- https://aistudio.google.com/api-reference/generate-content

`gemini-4-hydrogen` is the default naming model; Carbon is optional. The current server uses the documented POST `/v1beta/models/{model}:generateContent` interface with `contents[].parts[]`, inline image bytes and JSON response mode. The Decision API's image block schema and generateContent's `inlineData` schema differ and must not be mixed.

Names are cosmetic. If naming fails after a valid decision, the game keeps a generic object name and reports naming unavailability in the result. If the decision call fails, no ability is granted.

## Key and live checks

The project now has a local `.env` template. Fill in `GEMINI_API_KEY` there, then restart the server. The file is ignored by git and is not inside the served public folder. Neither code review nor the UI needs to print the key.

After the camera gate passes:

1. Capture and inspect a notebook photo locally.
2. Choose Bridge and explicitly evaluate the photo with Google.
3. Verify the actual returned probability, confidence, latency and model identifier.
4. Verify an empty or obscured frame does not grant a power.
5. Test a shield and reflector, then complete the traversal-to-boss run using real decisions.

No real API calls have been verified yet. Adding a key does not by itself prove the model is enabled for the account or has available quota.
