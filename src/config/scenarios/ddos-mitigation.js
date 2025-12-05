export const DDOS_MITIGATION_SCENARIOS = [
    {
        id: "scenario-ddos-bastion",
        title: "Edge Bastion: DDoS Clamp",
        subtitle: "Stabilize inbound floods",
        description: "Hold the perimeter while hostile traffic ramps faster than legitimate users. Layer defenses that soak and scrub a rolling DDoS wave without collapsing your budget.",
        summary: "Stack firewalls, scrubbers, and load balancers to survive an ever-growing malicious surge for two in-game minutes.",
        difficulty: "intermediate",
        tags: ["security", "ddos", "resilience"],
        worldId: "scenarios-frontline",
        startingBudget: 2500,
        packetIncreaseInterval: 0.2,
        internetPosition: { x: -18, y: 0, z: 0 },
        toolbarWhitelist: [
            "Select",
            "LinkTool",
            "Delete",
            "Firewall",
            "WAF",
            "Switch",
            "LoadBalancer",
            "Compute"
        ],
        preplacedNodes: [
            { type: "User", id: "user-west", position: { x: -4, y: 4 }, locked: true },
            { type: "User", id: "user-east", position: { x: -4, y: -4 }, locked: true },
            { type: "User", id: "user-core", position: { x: 2, y: 0 }, locked: true }
        ],
        trafficProfile: {
            spawnRps: 2.5,
            userToInternetPps: 0.6,
            maliciousRate: 2.2,
            rpsRampPerSecond: 0.05
        },
        instructions: [
            "Chain multiple perimeter devices (Firewall + WAF) before load balancing compute tiers.",
            "Keep at least two compute nodes online so benign requests keep finishing.",
            "If a firewall overloads, drop a spare and re-link while time is paused."
        ],
        tutorial: {
            enabled: true,
            steps: [
                {
                    id: "place-firewall",
                    text: "Place a Firewall directly in front of the Internet node to block the heaviest bursts first.",
                    toolWhitelist: ["Firewall"],
                    condition: { type: "hasServiceOfType", serviceType: "FIREWALL", countAtLeast: 1 }
                },
                {
                    id: "add-waf",
                    text: "Stack a Web Application Firewall right behind the perimeter to intercept fraud traffic.",
                    toolWhitelist: ["WAF"],
                    condition: { type: "hasServiceOfType", serviceType: "WAF", countAtLeast: 1 }
                },
                {
                    id: "link-defense",
                    text: "Link Internet → Firewall → WAF so every packet is filtered twice before reaching the core.",
                    toolWhitelist: ["LinkTool"],
                    condition: { type: "hasConnectionBetween", fromType: "INTERNET", toType: "WAF", bidirectional: true }
                }
            ]
        },
        winConditionId: "scenario_ddos_block_wave",
        failConditionId: "scenario_budget_collapse"
    }
];
