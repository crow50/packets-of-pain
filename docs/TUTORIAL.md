# Tutorial System Overview

The in-game tutorial controller reads its instructions from the `tutorial` object on every level, scenario, or sandbox configuration. Tutorials now work across Campaign, Sandbox, and future Scenario modes, so long as a configuration provides the expected structure described below.

## Top-Level Fields

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | Enables/disables the tutorial for the level. When `false` the UI immediately hides the tutorial panel. |
| `trigger` | `object` | Optional trigger describing when to start the tutorial (defaults to `level-start`). Supported shapes: `{ type: 'level-start' }`, `{ type: 'engine-event', eventName: 'requestFinished' }`. |
| `defaultTimeControlTarget` | `string \| null` | Optional button id (`btn-pause`, `btn-play`, `btn-fast`) to lock the time controls to during each step. Set to `null` to keep all time controls unlocked. |
| `steps` | `array` | Ordered list of tutorial steps (see schema below). |

## Step Schema

Each entry in `steps` supports the following fields:

- `id` *(string, optional but recommended)* – unique step identifier for debugging.
- `text` *(string, required)* – copy shown in the tutorial box.
- `highlight` *(object)* – `{ elementId: 'dom-id' }` to highlight a DOM node.
- `toolWhitelist` *(array of strings)* – overrides the toolbar whitelist for the duration of the step (uses the same identifiers as `toolbarWhitelist` in level configs).
- `condition` *(object, required)* – describes when the step is considered complete.
- `timeControlTarget` or `lockTimeControlTo` *(string)* – forces time controls to a single button for that step.
- `allowAllTimeControls` *(boolean)* – when true, unlocks every time control regardless of defaults.

## Condition Types

Tutorial completion conditions map directly to `condition.type`. Supported values:

| Type | Required Properties | Behavior |
| --- | --- | --- |
| `activeToolIs` | `toolId` (string) | Completes when the currently selected tool matches `toolId`. |
| `hasServiceOfType` | `serviceType` (string), `countAtLeast` (number) | Checks if at least `countAtLeast` services of the given type exist in the simulation. |
| `hasConnectionBetween` | `fromType`, `toType`, optional `bidirectional`, `fromId`, `toId` | Completes when a connection exists that matches the provided node filters. |
| `timeScaleAtLeast` | `value` (number) | Completes once the time-scale reaches the provided value (e.g., 1 for “Play”). |
| `serviceConnectionsAtLeast` | `serviceType`, `countAtLeast` | Ensures at least one service of `serviceType` owns `countAtLeast` links. |
| `allOf` | `conditions` (array) | Nested AND of child conditions. |
| `anyOf` | `conditions` (array) | Nested OR of child conditions. |

You can extend the system by adding new condition handlers inside `tutorialController.js`. Every condition has access to the active engine instance so it can inspect simulation (`engine.getSimulation()`) and UI (`engine.getUIState()`) data without referencing global mode strings.

## Multi-Mode Integration

- Tutorials are now mode-agnostic. Any mode that loads a level configuration (Campaign levels, Sandbox presets, Scenarios) can attach a `tutorial` object. The controller only checks the presence of that configuration, not the current `GAME_MODE`.
- Toolbar whitelists come from `toolbarController.getCurrentToolbarWhitelist()`, ensuring each mode’s tool availability is respected.
- Time control locks apply equally in Campaign, Sandbox, and Scenarios—set `defaultTimeControlTarget` to `null` to keep all controls active.
- To start a tutorial manually, call `configureTutorial(levelConfig, engine)` after loading/updating a level. The helper automatically schedules triggers and will stop any active tutorial when the level changes.

When designing new tutorials, keep steps short, leverage highlights for UI callouts, and pair them with the generalized objective system so that each mode communicates both *what* to do and *why* clearly.
