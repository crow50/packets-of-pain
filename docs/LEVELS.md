# Campaign Level Configuration

Campaign levels now live entirely under `src/config/campaign/` so the UI, shop, and runtime code can share the same source of truth without reaching for a global `LEVELS` map.

## Structure

- **Domain files** (`domain-*.js`) describe a networking domain or "world" (e.g., Baby's First Network). Each domain exports metadata (id, title, subtitle, description) plus a `DOMAIN_..._LEVELS` array that lists every level belonging to that domain.
- **Level entries** are plain objects with fields such as `id`, `domainId`, `title`, `subtitle`, `description`, `startingBudget`, `toolbarWhitelist`, `trafficProfile`, `preplacedNodes`, `instructions`, `winConditionId`, and `failConditionId`. These objects mirror the old `LEVELS` entries and may include domain-specific helpers or tooling hints as needed.
- **`campaign/index.js`** collects all domains and levels, builds `LEVEL_CACHE`/`DOMAIN_CACHE`, and exports helpers (`getDomainById`, `getLevelsForDomain`, `getLevelById`, etc.) so downstream modules never import individual level files directly.
- **Runtime helpers** consume `getLevelById` for loading/start/reset flows, `getLevelsForDomain` for rendering the campaign hub, and the shop uses the same helper to derive toolbar whitelists.

## Adding a Domain or Level

1. Create a new domain file (e.g., `domain-deeper-net.js`) in `src/config/campaign/` that exports the domain metadata and its `DOMAIN_..._LEVELS` array.
2. Append the new level objects to the domain's array. Include all required fields and any custom instructions or win/fail IDs.
3. Import the new domain (and its level array) from `campaign/index.js` so it is included in `CAMPAIGN_LEVELS`. The caches update automatically.
4. Update UI or campaigns that need to reference the new domain by using the helper functions instead of touching `LEVELS` or the caches directly.

## Verification

- Run `renderCampaignLevels` in the UI to ensure the new domain's levels appear in the correct world list.
- Use `getLevelById` when hooking into traffic profiles or objectives so the runtime respects the new configuration.
- When introducing new event-driven behavior tied to a level, remember to document the event in `docs/EVENTS.md` per the dev rules.
