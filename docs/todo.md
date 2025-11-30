- [x] Verify sandbox refactor and capture any regressions during manual walkthroughs.
- [ ] Split campaign and sandbox fully into separate modes with distinct documentation.
	- [x] Move sandbox-specific UI/HUD toggles out of `gameCore.startSandbox` into a `ui/sandboxMode` helper that `SandboxModeController` owns.
	- [x] Replace `setCampaignUIActive` with a neutral `setModeUIActive(modeId)` so scenarios/sandbox no longer lean on campaign naming.
	- [x] Add a `showView('scenarios')`/`setHUDMode('scenarios')` path so scenarios don't proxy through the campaign view.
- [ ] Add scenarios mode documentation and examples.
- [ ] Create a dedicated scenarios briefing/objective panel instead of reusing the campaign panel so future scenario-only UI changes stay isolated.
- [ ] Fully define HUD vs Game canvas responsibilities and interactions. Three.js vs index.html.
- [ ] Didn't we stop with DOM manipulation in engine code? Audit and document any remaining cases.
- [ ] Packets should flow like normal traffic, while connecting anything directly to the internet is valid, edge devices should be the only services allowed to connect directly to the internet. Document and enforce this.
- [ ] Define edge device behavior and document it.
- [ ] visual editor (node placement UI, connection drawing, objective builder)
- [ ] Update FAQ/Help modal
- [ ] Create left-column in hud ui for tutorials, move tutorials to left column from right column

# Engine

- [ ] Everything is config driven; document all config options. IE campaign domains and levels, services, objectives, traffic profiles, scenarios packets, etc.
- [ ] Add more detailed documentation for engine configuration options.
- [ ] Write examples for custom engine events and how to handle them in levels.

# Campaign

## Levels

- [ ] Create a template for new levels to streamline the creation process.
- [ ] Document best practices for level design and balancing difficulty.

### Ideas

**Humble HomeLab**
- Introduction to home networking with basic services.

# Scenarios

- [ ] Document how to create and configure scenarios.
- [ ] Provide examples of different scenario types and their objectives.
- [ ] Explain how to integrate scenarios into the main game loop.
- [ ] Allow uploading and sharing of custom scenarios.

# Services

- [ ] Verify services are config driven
- [ ] Document all available services and their configurations.
- [ ] Provide examples of service interactions and dependencies.
- [ ] Explain how to create custom services and integrate them into levels.

# Documentation

- [ ] Audit existing documentation for accuracy and completeness.
- [ ] Create issue templates for GitHub

# Code Quality

# Security
