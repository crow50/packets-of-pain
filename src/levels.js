const LEVELS = {
    "baby-1": {
        id: "baby-1",
        worldId: "multi-domain",
        title: "Baby's First Network — Level 1",
        subtitle: "Modem Basics",
        description: "Place your first modem and create a working link between a user and the internet.",
        startingBudget: 100,
        toolbarWhitelist: ["Select", "LinkTool"],
        preplacedNodes: [
            { type: "User", id: "user-1", position: { x: -4, y: 0 } },
            { type: "Internet", id: "inet-1", position: { x: 4, y: 0 } }
        ],
        trafficProfile: {
            mode: "simple",
            userToInternetPps: 1,
            maliciousRate: 0
        },
        instructions: [
            "Buy a Modem from the toolbar.",
            "Place it between the User and the Internet.",
            "Use the Link Tool to connect User → Modem → Internet.",
            "Keep packets flowing for 10 seconds to win."
        ],
        winConditionId: "baby1_packets_10s",
        failConditionId: "baby_generic_satisfaction_or_score"
    },
    "baby-2": {
        id: "baby-2",
        worldId: "multi-domain",
        title: "Baby's First Network — Level 2",
        subtitle: "Firewalls vs Malicious Traffic",
        description: "Learn to deploy a WAF so malicious packets stay at the border.",
        startingBudget: 150,
        toolbarWhitelist: ["Select", "LinkTool", "WAF"],
        preplacedNodes: [
            { type: "User", id: "user-1", position: { x: -6, y: 0 } },
            { type: "Internet", id: "inet-1", position: { x: 6, y: 0 } }
        ],
        trafficProfile: {
            mode: "simple",
            userToInternetPps: 1.5,
            maliciousRate: 0.25
        },
        instructions: [
            "Place a WAF near the Internet node.",
            "Connect the WAF between the User and Internet.",
            "Allow regular packets through while blocking malicious ones.",
            "Survive until your WAF has blocked 3 hostile packets."
        ],
        winConditionId: "baby2_waf_blocks",
        failConditionId: "baby_generic_satisfaction_or_score"
    },
    "baby-3": {
        id: "baby-3",
        worldId: "multi-domain",
        title: "Baby's First Network — Level 3",
        subtitle: "Switches & Multiple Clients",
        description: "Multiple users flood the network, so build a resilient path.",
        startingBudget: 200,
        toolbarWhitelist: ["Select", "LinkTool", "WAF", "LoadBalancer"],
        preplacedNodes: [
            { type: "User", id: "user-1", position: { x: -7, y: 0 } },
            { type: "User", id: "user-2", position: { x: -3, y: 0 } },
            { type: "Internet", id: "inet-1", position: { x: 7, y: 0 } }
        ],
        trafficProfile: {
            mode: "simple",
            userToInternetPps: 2.5,
            maliciousRate: 0.4
        },
        instructions: [
            "Handle two users simultaneously by linking them to your topology.",
            "Place a WAF and Load Balancer to separate fraud from legitimate traffic.",
            "Keep packet flow steady for 15 seconds to win."
        ],
        winConditionId: "baby3_multi_user",
        failConditionId: "baby_generic_satisfaction_or_score"
    }
};

export { LEVELS };
