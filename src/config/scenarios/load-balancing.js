export const LOAD_BALANCING_SCENARIOS = [
    {
        id: "scenario-hybrid-burst",
        title: "Hybrid Burst SLO",
        subtitle: "Keep latency low while demand spikes",
        description: "A product launch sends alternating API/Web bursts at your edge. Spin up redundant balancers and compute tiers fast enough to avoid saturation penalties.",
        summary: "Maintain reputation above 80 while processing 500 mixed packets without dropping below the SLO threshold.",
        difficulty: "advanced",
        tags: ["scaling", "hybrid", "slo"],
        worldId: "scenarios-hybrid-cloud",
        startingBudget: 3200,
        packetIncreaseInterval: 0.12,
        internetPosition: { x: -15, y: 0, z: 0 },
        toolbarWhitelist: [
            "Select",
            "LinkTool",
            "Delete",
            "LoadBalancer",
            "Compute",
            "ObjectStorage",
            "Database",
            "Switch"
        ],
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
                {
                    id: "deploy-balancer",
                    text: "Drop a Load Balancer near the Internet node so you can split the launch traffic.",
                    toolWhitelist: ["LoadBalancer"],
                    condition: { type: "hasServiceOfType", serviceType: "LOADBALANCER", countAtLeast: 1 }
                },
                {
                    id: "fan-out-compute",
                    text: "Attach at least two Compute nodes behind the balancer to absorb the burst.",
                    toolWhitelist: ["Compute"],
                    condition: { type: "hasServiceOfType", serviceType: "COMPUTE", countAtLeast: 2 }
                },
                {
                    id: "connect-storage",
                    text: "Finish the path by wiring storage/database targets so requests can complete end-to-end.",
                    toolWhitelist: ["LinkTool"],
                    condition: { type: "hasConnectionBetween", fromType: "COMPUTE", toType: "DATABASE", bidirectional: true }
                }
            ]
        },
        instructions: [
            "Keep at least two compute lanes active; upgrade tiers instead of spamming nodes once budget dips.",
            "Object Storage can terminate heavy web assets so compute nodes stay free for API calls.",
            "Burst windows arrive every 20 seconds—pause and add capacity before the next spike."
        ],
        winConditionId: "scenario_launch_uptime",
        failConditionId: "scenario_reputation_crash"
    }
];
