# Campaign Level Configuration

Campaign levels now live entirely under `src/config/campaign/` so the UI, shop, and runtime code can share the same source of truth without reaching for a global `LEVELS` map.

## Structure

- **Domain files** (`domain-*.js`) describe a networking domain or "world" (e.g., Baby's First Network). Each domain exports a metadata object named `DOMAIN_<UPPER_SNAKE_NAME>` (matching the file slug) plus a `DOMAIN_<UPPER_SNAKE_NAME>_LEVELS` array that lists every level belonging to that domain. Keep this naming scheme in sync with the file name so the campaign registry can build `CAMPAIGN_DOMAINS`/`CAMPAIGN_LEVELS` automatically.
- **Level entries** are plain objects with fields such as `id`, `domainId`, `title`, `subtitle`, `description`, `startingBudget`, `toolbarWhitelist`, `trafficProfile`, `internetPosition`, `preplacedNodes`, `instructions`, `winConditionId`, and `failConditionId`. These objects mirror the old `LEVELS` entries and may include domain-specific helpers or tooling hints as needed.
	- `internetPosition` is optional; when provided it overrides the engine's default `{ x: -10, y: 0, z: 0 }` spawn point so packets (and the Internet mesh) appear where the scenario expects (e.g., far left/right, offset vertically for special events). Sandbox and survival configs can also pass this field through the runtime when they need custom ingress positions.
	- `tutorial` (optional) activates the HUD tutorial brain for a level. See “Tutorial Blocks” below for schema details.
- **`campaign/index.js`** collects all domains and levels, builds `LEVEL_CACHE`/`DOMAIN_CACHE`, and exports helpers (`getDomainById`, `getLevelsForDomain`, `getLevelById`, etc.) so downstream modules never import individual level files directly.
- **Runtime helpers** consume `getLevelById` for loading/start/reset flows, `getLevelsForDomain` for rendering the campaign hub, and the shop uses the same helper to derive toolbar whitelists.

## Tutorial Blocks

Campaign levels can define a lightweight tutorial script via a `tutorial` object:

```js
tutorial: {
	enabled: true,
	trigger: { type: "level-start" },
	steps: [
		{
			id: "place-modem",
			text: "Drop a modem in the center lane.",
			highlight: { elementId: "canvas-container" },
			toolWhitelist: ["Select", "Modem"],
			timeControlTarget: "btn-play", // optional lock for pause/play buttons
			condition: { type: "hasServiceOfType", serviceType: "MODEM", countAtLeast: 1 }
		}
	]
}
```

**Step fields**
- `id`: Stable string for logging/debugging.
- `text`: Copy shown inside the HUD tutorial box.
- `highlight.elementId`: Optional DOM id to pulse with `.tutorial-highlight` (any HUD/button/canvas element works).
- `toolWhitelist`: Optional override of the normal toolbar whitelist for that step (falls back to the level’s default list when omitted).
- `timeControlTarget`/`lockTimeControlTo`: Optional button id (`btn-play`, `btn-pause`, `btn-fast`) to keep enabled while other time buttons stay disabled.
- `condition`: Predicate that advances the tutorial when it returns `true`.

**Triggering the tutorial brain**
- `trigger` defaults to `{ type: "level-start" }`, which launches the tutorial as soon as the level loads.
- Set `{ type: "engine-event", eventName: "serviceAdded" }` (or any emitted engine event) to delay startup until that event fires. The controller automatically subscribes once per level and detaches after it runs.
- Additional trigger types can be added later; until then, `level-start` and `engine-event` cover “immediate onboarding” vs. “react when X happens” use cases.

**Supported condition types**
- `activeToolIs` – `{ type: "activeToolIs", toolId: "modem" }`
- `hasServiceOfType` – `{ type: "hasServiceOfType", serviceType: "MODEM", countAtLeast: 1 }`
- `hasConnectionBetween` – `{ type: "hasConnectionBetween", fromType: "MODEM", toType: "INTERNET", bidirectional: true }`
- `serviceConnectionsAtLeast` – `{ type: "serviceConnectionsAtLeast", serviceType: "MODEM", countAtLeast: 2 }`
- `timeScaleAtLeast` – `{ type: "timeScaleAtLeast", value: 1 }`
- `allOf` / `anyOf` – `{ type: "allOf", conditions: [ { ... }, { ... } ] }` for composing multiple predicates.

When `tutorial.enabled` is falsey or omitted, the tutorial box stays hidden and the player retains the normal toolbar/time controls for that level. The Skip button always calls `window.skipTutorial()` which immediately restores the level’s default whitelist/time controls.

## Adding a Domain or Level

1. Create a new domain file (e.g., `domain-deeper-net.js`) in `src/config/campaign/` that exports the domain metadata and its `DOMAIN_..._LEVELS` array.
2. Append the new level objects to the domain's array. Include all required fields and any custom instructions or win/fail IDs.
3. Import the new domain (and its level array) from `campaign/index.js` so it is included in `CAMPAIGN_LEVELS`. The caches update automatically.
4. Update UI or campaigns that need to reference the new domain by using the helper functions instead of touching `LEVELS` or the caches directly.

## Verification

- Run `renderCampaignLevels` in the UI to ensure the new domain's levels appear in the correct world list.
- Use `getLevelById` when hooking into traffic profiles or objectives so the runtime respects the new configuration.
- When introducing new event-driven behavior tied to a level, remember to document the event in `docs/EVENTS.md` per the dev rules.
