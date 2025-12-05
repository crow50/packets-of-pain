export const TRAFFIC_SHAPING_SCENARIOS = [
    {
        id: "scenario-surge-control",
        title: "Surge Control Sandbox",
        subtitle: "Balance sandbox toggles under pressure",
        description: "A sandbox-style challenge where time dilation controls when the city portal opens. Keep money positive while experimenting with traffic shaping tools.",
        summary: "Experiment with shapers and throttles; keep budget above zero for 90 seconds while satisfying VIP traffic.",
        difficulty: "casual",
        tags: ["sandbox", "traffic", "education"],
        worldId: "scenarios-sandbox",
        startingBudget: 1800,
        packetIncreaseInterval: 0.08,
        internetPosition: { x: -12, y: 0, z: 0 },
        toolbarWhitelist: [
            "Select",
            "LinkTool",
            "Delete",
            "Firewall",
            "Switch",
            "LoadBalancer",
            "Compute"
        ],
        preplacedNodes: [
            { type: "User", id: "vip-user", position: { x: 4, y: 2 }, locked: true },
            { type: "User", id: "free-user", position: { x: 4, y: -2 }, locked: true }
        ],
        trafficProfile: {
            spawnRps: 0.9,
            userToInternetPps: 0.9,
            maliciousRate: 0.1,
            inboundOnly: false
        },
        instructions: [
            "Scale time only when ready—the scenario rewards pausing to plan upgrades.",
            "Use Switches to split VIP and free users so you can prioritize compute capacity.",
            "Staying solvent is more important than processing every packet—shed free users if needed."
        ],
        tutorial: {
            enabled: false
        },
        winConditionId: "scenario_sandbox_budget",
        failConditionId: "scenario_budget_collapse"
    }
];
