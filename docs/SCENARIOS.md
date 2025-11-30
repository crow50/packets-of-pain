# Scenario Configuration

Scenarios live entirely under `src/config/scenarios/` so the runtime, HUD, and controllers can load curated challenges without touching the campaign progression tree. Each file (e.g., `ddos-mitigation.js`, `load-balancing.js`, `traffic-shaping.js`) exports an array of plain objects that describe those challenges. `src/config/scenarios/index.js` merges the arrays, normalizes a few shared fields, and exposes helpers (`getScenarioById`, `getAllScenarios`) that every caller should use instead of importing individual files.

## Structure

- **Scenario files** – Group related challenges by theme. The file simply exports an array (`DDOS_MITIGATION_SCENARIOS`, etc.) of configuration objects.
- **`scenarios/index.js`** – Imports every array, concatenates them into `SCENARIOS`, applies shared defaults (ensures array fields exist, normalizes tutorials/traffic profile), and builds a `Map` cache for O(1) lookups by id.
- **UI/runtime** – `src/ui/scenariosController.js` loads configs via `getScenarioById`, applies tool/shop whitelists, spawns preplaced nodes, wires objectives into the Scenario Briefing panel, and forwards win/fail hooks to the mode-state helpers.

## Scenario Object Fields

Each scenario entry is a plain object. All fields are optional unless stated otherwise.

| Field | Type | Description |
| --- | --- | --- |
| `id` *(required)* | `string` | Stable identifier referenced by the UI (`POP.startScenario(id)`) and mode state. Must be unique across all scenario files. |
| `title` | `string` | Display name shown in the modal and Scenario Briefing panel. |
| `subtitle` | `string` | Secondary label (e.g., mission codename). Falls back to `worldId` when omitted. |
| `worldId` | `string` | Logical grouping shown as a kicker label in the modal. Hyphen/underscore names are prettified automatically. |
| `summary` / `description` | `string` | Short copy for the modal card and Scenario Briefing summary. `summary` takes precedence, `description` is used as a fallback. |
| `difficulty` | `"training" | "intermediate" | "advanced" | string` | Renders in the Scenario Briefing badge so players know the expected challenge level. |
| `tags` | `string[]` | Up to three concise tags (e.g., `scaling`, `slo`, `fraud`). Rendered as pills within the modal and Scenario Briefing panel. |
| `startingBudget` | `number` | Initial money allocated when the session loads. |
| `packetIncreaseInterval` | `number` | Optional scalar consumed by traffic helpers to ramp packet spawn frequency. |
| `internetPosition` | `{ x, y, z }` | Overrides the default Internet node position so packets spawn from a custom point. |
| `toolbarWhitelist` | `string[]` | Limits the toolbar to specific tools/services. Passed directly to `applyToolbarWhitelist`, just like campaign levels. |
| `preplacedNodes` | `Array<{ type, id?, position, tier?, locked?, lockPosition? }>` | Nodes spawned automatically before the player starts. Shares the same schema as campaign preplacements and leverages `spawnNodeFromConfig`. |
| `trafficProfile` | `object` | Shape matches `sim/economy.js` helpers (`spawnRps`, `userToInternetPps`, `maliciousRate`, `inboundOnly`, `rpsRampPerSecond`). Missing values fall back to defaults in `scenarios/index.js`. |
| `tutorial` | `{ enabled, steps: [...] }` | Hooks into the HUD tutorial system. Syntax mirrors the campaign tutorial blocks documented in `docs/LEVELS.md`. |
| `instructions` | `string[]` | Bullet points rendered inside the Scenario Briefing objectives list. When empty, the HUD shows a generic “stabilize the topology” objective. |
| `topologyGuidance` | `Array` | Optional array passed to `setTopologyGuidance` so the HUD can surface hints about required links or topology constraints. |
| `winConditionId` / `failConditionId` | `string` | Keys understood by `levelConditions.js`. They map to predefined rule sets (reputation thresholds, processed packet counts, etc.). |
| `toolbarWhitelist` / `serviceList` | `string[]` | When populated, they drive the shop (either via `mapWhitelistToServices` or the sandbox fallback) so scenarios can restrict available infrastructure. |

The helper in `scenarios/index.js` pre-fills `toolbarWhitelist`, `preplacedNodes`, and `instructions` with empty arrays so downstream code can rely on array semantics without performing repeated guards.

## Example Entry

```js
export const LOAD_BALANCING_SCENARIOS = [
  {
    id: "scenario-hybrid-burst",
    title: "Hybrid Burst SLO",
    subtitle: "Keep latency low while demand spikes",
    description: "A product launch sends alternating API/Web bursts at your edge...",
    summary: "Maintain reputation above 80 while processing 500 mixed packets...",
    difficulty: "advanced",
    tags: ["scaling", "hybrid", "slo"],
    worldId: "scenarios-hybrid-cloud",
    startingBudget: 3200,
    packetIncreaseInterval: 0.12,
    internetPosition: { x: -15, y: 0, z: 0 },
    toolbarWhitelist: ["Select", "LinkTool", "Delete", "LoadBalancer", "Compute", "ObjectStorage", "Database", "Switch"],
    preplacedNodes: [
      { type: "User", id: "launch-west", position: { x: -2, y: 5 }, locked: true },
      { type: "User", id: "launch-east", position: { x: -2, y: -5 }, locked: true },
      { type: "Internet", id: "inet-edge", position: { x: -8, y: 0 }, locked: true }
    ],
    trafficProfile: {
      spawnRps: 1.4,
      userToInternetPps: 1.1,
      maliciousRate: 0.05,
      inboundOnly: false
    },
    tutorial: {
      enabled: true,
      steps: [
        { id: "deploy-balancer", text: "Drop a Load Balancer...", toolWhitelist: ["LoadBalancer"], condition: { type: "hasServiceOfType", serviceType: "LOADBALANCER", countAtLeast: 1 } },
        // ...remaining steps
      ]
    },
    instructions: [
      "Keep at least two compute lanes active...",
      "Object Storage can terminate heavy web assets...",
      "Burst windows arrive every 20 seconds..."
    ],
    winConditionId: "scenario_launch_uptime",
    failConditionId: "scenario_reputation_crash"
  }
];
```

## Adding or Updating Scenarios

1. Pick (or create) a thematic file under `src/config/scenarios/` and append a new object that follows the schema above.
2. Export the array and ensure it is imported into `src/config/scenarios/index.js` so it participates in the `SCENARIOS` list.
3. Reference the new `id` when wiring UI flows (`POP.startScenario('scenario-hybrid-burst')`). The Scenario Browser pulls automatically from `getAllScenarios()`, so no additional UI work is needed unless you want bespoke copy.
4. If the scenario needs new win/fail logic, add the rule to `src/ui/levelConditions.js` and document it in `docs/EVENTS.md` or the relevant design doc.
5. Run through the HUD manually (or via Puppeteer) to confirm the Scenario Briefing panel renders title, summary, tags, instructions, and that tool/shop whitelists behave as expected.

## Verification Checklist

- Scenario appears in the modal grid with the correct tags and difficulty badge.
- Starting the scenario pauses the game, shows the Scenario Briefing panel, and highlights the instructions provided.
- Toolbar whitelist and preplaced nodes match the config.
- Win/fail conditions trigger the intended modal copy.
- Documentation references (`docs/SCENARIOS.md`, this file) are updated whenever new fields are introduced so downstream contributors have an authoritative schema.
