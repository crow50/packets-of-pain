# File Map

| File | Role | Depends on | Touches DOM? | Notes |
| --- | --- | --- | --- | --- |
| src/main.js | UI_LAYER | bootstrap, HUD | Yes | Entry that waits for DOM ready and starts bootstrap. |
| src/bootstrap.js | UI_LAYER | createEngine, modeManager, render managers | Yes | Wires engine/runtime to DOM; injects engine into modules (no globals). |
| src/gameCore.js | UI_LAYER | engine, render managers, runtime utils | Yes | High-level game reset/menu sound helpers; uses runtime getter for engine. |
| src/core/engine.js | ENGINE_CORE | traffic, economy, modeBehaviors, tools | No | Central state + step + UI state setters; emits events. |
| src/core/loop.js | UI_LAYER | requestManager, serviceManager, engine | Yes | Animation loop bridging engine ticks to render sync. |
| src/core/modeManager.js | ENGINE_CORE | modes/index, engine | No | Manages active mode controller lifecycle. |
| src/core/routing.js | ENGINE_CORE | serviceCatalog (module), spanning tree | No | Catalog-driven routing + congestion checks. |
| src/config/gameConfig.js | ENGINE_CONFIG | constants | No | Default values for game; no DOM. |
| src/config/packetConfig.js | ENGINE_CONFIG | TRAFFIC_CLASS, PACKET_PHASE | No | Packet enums/colors. |
| src/config/serviceCatalog.js | ENGINE_CONFIG | SERVICE_KIND/ROLE | No | Service definitions; module-only (no globals). |
| src/config/campaign/domain-babys-first-network.js | ENGINE_CONFIG | serviceCatalog | No | Campaign domain data. |
| src/config/campaign/domains.js | ENGINE_CONFIG | serviceCatalog | No | Domain list metadata. |
| src/config/campaign/index.js | ENGINE_CONFIG | domains, levels | No | Campaign level registry helpers. |
| src/config/scenarios/index.js | ENGINE_CONFIG | scenario configs | No | Scenario registry. |
| src/config/scenarios/ddos-mitigation.js | ENGINE_CONFIG | serviceCatalog | No | Scenario seed data. |
| src/config/scenarios/load-balancing.js | ENGINE_CONFIG | serviceCatalog | No | Scenario seed data. |
| src/config/scenarios/traffic-shaping.js | ENGINE_CONFIG | serviceCatalog | No | Scenario seed data. |
| src/entities/Request.js | ENGINE_CORE | packetConfig | No | Packet entity w/ TTL, flyTo; uses runtime getter for engine events. |
| src/entities/Service.js | ENGINE_CORE | serviceCatalog, routing, traffic | No | Service node processing + routing handoff; no globals. |
| src/services/AssetService.js | UI_LAYER | fetch, document | Yes | Loads icons/sounds, caches, DOM image creation. |
| src/services/SoundService.js | UI_LAYER | AudioContext, window events | Yes | Audio playback; resumes on user gesture. |
| src/sim/economy.js | ENGINE_CORE | CONFIG, engine | No | Money/reputation/time helpers; sets traffic profiles; attaches engine at runtime. |
| src/sim/tools.js | ENGINE_CORE | Service, Request, state | No | Create/delete services/links; tool state; attaches engine at runtime. |
| src/sim/traffic.js | ENGINE_CORE | Request, modeBehaviors, packetConfig | No | Packet lifecycle and scoring; attaches engine at runtime. |
| src/sim/spanningTree.js | ENGINE_CORE | ConnectionUtils | No | Builds/updates STP forwarding tables. |
| src/sim/vectorUtils.js | ENGINE_CORE | THREE (global) | No | Position helpers. |
| src/sim/connectionUtils.js | ENGINE_CORE | n/a | No | Connection list/upgrade helpers; module-only. |
| src/modes/constants.js | ENGINE_CONFIG | n/a | No | Mode enum helpers. |
| src/modes/index.js | ENGINE_CORE | mode controllers map | No | Registers and fetches mode controllers. |
| src/modes/modeBehaviors.js | ENGINE_CORE | n/a | No | Behavior overrides per mode. |
| src/modes/campaignMode.js | ENGINE_CORE | engine, modeBehaviors | No | Campaign controller: level loading, economy hooks. |
| src/modes/sandboxMode.js | ENGINE_CORE | engine, toolbars | No | Sandbox controller; enables shop/budget controls. |
| src/modes/scenariosMode.js | ENGINE_CORE | scenario configs | No | Scenario controller; sets behaviors. |
| src/modes/trafficBehaviors.js | ENGINE_CORE | modeBehaviors, sim | No | Traffic source selection behaviors. |
| src/render/scene.js | UI_LAYER | THREE, camera, container | Yes | Scene init, camera controls. |
| src/render/interactions.js | UI_LAYER | THREE, document | Yes | Mouse picking + grid snap; tooltip update. |
| src/render/serviceManager.js | UI_LAYER | scene, AssetService | Yes | Mesh creation for services. |
| src/render/connectionManager.js | UI_LAYER | scene | Yes | Link meshes + geometry updates. |
| src/render/requestManager.js | UI_LAYER | scene, packetConfig | Yes | Request meshes + animations. |
| src/render/renderManagers.js | UI_LAYER | request/service/connection managers | Yes | Aggregates render sync. |
| src/ui/hud.js | UI_LAYER | document, HUD elements | Yes | HUD panels, FAQ, objective rendering. |
| src/ui/hudController.js | UI_LAYER | hud, engine stats | Yes | Updates HUD values, warnings, game over modal. |
| src/ui/menuController.js | UI_LAYER | hud, navigation | Yes | HUD dropdowns, main menu buttons; calls navigation helpers. |
| src/ui/timeControls.js | UI_LAYER | engine, window events | Yes | Speed controls + restart button; pulls engine via runtime getter. |
| src/ui/toolbarController.js | UI_LAYER | toolSync | Yes | Toolbar whitelist, button highlighting. |
| src/ui/toolSync.js | UI_LAYER | document buttons | Yes | Sync toolbar buttons with active tool. |
| src/ui/inputController.js | UI_LAYER | THREE, document | Yes | Mouse/keyboard handlers, raycasting. |
| src/ui/sandboxController.js | UI_LAYER | engine sandbox setters | Yes | Budget/RPS controls panel. |
| src/ui/sandboxMode.js | UI_LAYER | hudController, toolSync | Yes | Sandbox HUD setup. |
| src/ui/scenariosController.js | UI_LAYER | scenarios config | Yes | Scenario browser DOM; uses navigation helpers. |
| src/ui/campaign.js | UI_LAYER | serviceCatalog (module), engine | Yes | Campaign hub screens, level loading; engine injected. |
| src/ui/levelConditions.js | UI_LAYER | engine stats | Yes | Level win/lose messaging. |
| src/ui/gameOverController.js | UI_LAYER | hudController | Yes | Game-over modal wiring. |
| src/ui/tutorialController.js | UI_LAYER | document | Yes | Tutorial steps, highlights, skip controls. |
| src/ui/shop.js | UI_LAYER | serviceCatalog (module) | Yes | Build shop buttons/tiles. |
| src/ui/navigation.js | UI_LAYER | modeManager | No | Starts sandbox/campaign/scenario/level via switchToMode. |
| src/ui/soundControls.js | UI_LAYER | runtime getter | Yes | Mute toggles and menu sound. |
| src/utils/runtime.js | ENGINE_CORE | n/a | No | Holds current engine/runtime references (no DOM). |
