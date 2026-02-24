export const DOMAIN_BABYS_FIRST_NETWORK = {
	id: "babys-first-network",
	title: "Baby's First Network",
	subtitle: "Aww, ain't it cute?",
	description:
		"Take your first steps assembling modems, firewalls, and switches in a guided playground.",
	icon: "🔰", // TODO: Currently unused metadata
	order: 0,
	topologyGuidance: [] // TODO: Currently unused metadata
};

export const DOMAIN_BABYS_FIRST_NETWORK_LEVELS = [
	{
		id: "babys-first-network-level-1",
	 	domainId: DOMAIN_BABYS_FIRST_NETWORK.id,
		title: "Baby's First Network - Level 1",
		subtitle: "Internet Basics",
		description:
			"What's this box do? Use the device your ISP gave you to get online for the first time.",
		startingBudget: 100,
		toolbarWhitelist: ["Select", "LinkTool", "Delete", "Modem"],
		internetPosition: { x: -18, y: 0, z: 0 },
		preplacedNodes: [
			{ type: "User", id: "Your little sister demanding 'Coco-Melon'", position: { x: 8, y: 0 } },
		],
		trafficProfile: {
			mode: "simple",
			userToInternetPps: 0,
			maliciousRate: 0,
			inboundOnly: true,
			spawnRps: 0.25,
			rpsRampPerSecond: 0,
		},
		tutorial: {
			enabled: true,
			trigger: { type: "level-start" },
			steps: [
				{
					id: "select-modem",
					text: "Select the Modem, connecting this piece of equipment from your ISP is the first step to getting online.",
					highlight: { elementId: "tool-modem" }, // TODO: Highlighting the element causes the tutorial to evaluate condition as true before user interaction
					toolWhitelist: ["Select","Modem"], // Added "Select" to whitelist to prevent skipping step
					condition: { type: "activeToolIs", toolId: "modem" }
				},
				{
					id: "place-modem",
					text: "Place that Modem between the User and Internet.",
					highlight: { elementId: "canvas-container" },
					toolWhitelist: ["Modem"],
					condition: { type: "hasServiceOfType", serviceType: "MODEM", countAtLeast: 1 }
				},
				{
					id: "select-link-tool",
					text: "Great! Switch to the Link tool so we can wire packets through the Modem.",
					highlight: { elementId: "tool-connect" },
					toolWhitelist: ["Select", "LinkTool"], // Added "Select" to whitelist to prevent "skipping" step
					condition: { type: "activeToolIs", toolId: "connect" }
				},
				{
					id: "connect-internet",
					text: "Click the Modem and then the Internet. Solid lines mean packets can flow.",
					highlight: { elementId: "canvas-container" },
					toolWhitelist: ["LinkTool"],
					condition: { type: "hasConnectionBetween", fromType: "MODEM", toType: "INTERNET", bidirectional: true }
				},
				{
					id: "connect-user",
					text: "Now connect the Modem back to your End-User so so the modem now has two links.",
					highlight: { elementId: "canvas-container" },
					toolWhitelist: ["LinkTool"],
					condition: { type: "serviceConnectionsAtLeast", serviceType: "MODEM", countAtLeast: 2 }
				},
				{
					id: "press-play",
					text: "Hit Play to unpause time and watch packets test your tiny network.",
					highlight: { elementId: "btn-play" },
					timeControlTarget: "btn-play",
					toolWhitelist: [""], // Restrict all tools to force focus on time controls
					condition: { type: "timeScaleAtLeast", value: 1 }
				}
			]
		},
		instructions: [
			"Use the time controls (pause/play/fast-forward) to slow or speed traffic while you plan.",
			"Watch the Satisfaction meter, too low and your users will leave.",
			"The Modem is what translates the Internet from your ISP into something our computers can use.",
			"Keeping the route short and direct helps packets arrive faster.",
			"Connect the user to the Internet and keep packets flowing for 10 seconds.",
		],
		topologyGuidance: [
			"Use the User's fixed spot as an anchor and drop the Modem mid-lane for short links.",
			"Keep the Modem roughly centered so both links stay short.",
			"Avoid crossing wires; reroute with Select if a link looks messy."
		],
		winConditionId: "baby1_packets_10s",
		failConditionId: "baby_no_packets_timeout",
	},
	{
		id: "baby-2",
	 	domainId: DOMAIN_BABYS_FIRST_NETWORK.id,
		worldId: "multi-domain",
		title: "Baby's First Network — Level 2",
		subtitle: "Firewalls vs Malicious Traffic",
		description: "Learn to deploy a Firewall so malicious packets stay at the border.",
		startingBudget: 150,
		toolbarWhitelist: ["Select", "LinkTool", "Firewall"],
		internetPosition: { x: -18, y: 0, z: 0 },
		preplacedNodes: [
			{ type: "User", id: "user-1", position: { x: -6, y: 0 } },
			{ type: "Internet", id: "inet-1", position: { x: 6, y: 0 } },
		],
		trafficProfile: {
			mode: "simple",
			userToInternetPps: 1.5,
			maliciousRate: 0.25,
		},
		instructions: [
			"Place a Firewall near the Internet node.",
			"Connect the Firewall between the User and Internet.",
			"Allow regular packets through while blocking malicious ones.",
			"Survive until your Firewall has blocked 3 hostile packets.",
		],
		topologyGuidance: [
			"A Firewall near the Internet stops threats before they reach the LAN.",
			"Ensure every User path travels through the Firewall before hitting the Internet.",
			"If packets bypass the Firewall, break and reroute those links."
		],
		winConditionId: "baby2_firewall_blocks",
		failConditionId: "baby_generic_satisfaction_or_score",
	},
	{
		id: "baby-3",
	 	domainId: DOMAIN_BABYS_FIRST_NETWORK.id,
		worldId: "multi-domain",
		title: "Baby's First Network — Level 3",
		subtitle: "Switches & Multiple Clients",
		description: "Multiple users flood the network, so build a resilient path.",
		startingBudget: 200,
		toolbarWhitelist: ["Select", "LinkTool", "Firewall", "Switch"],
		internetPosition: { x: -18, y: 0, z: 0 },
		preplacedNodes: [
			{ type: "User", id: "user-1", position: { x: -7, y: 0 } },
			{ type: "User", id: "user-2", position: { x: -3, y: 0 } },
			{ type: "Internet", id: "inet-1", position: { x: 7, y: 0 } },
		],
		trafficProfile: {
			mode: "simple",
			userToInternetPps: 2.5,
			maliciousRate: 0.4,
		},
		instructions: [
			"Handle two users simultaneously by linking them to your topology.",
			"Place a Firewall and Switch to separate fraud from legitimate traffic.",
			"Keep packet flow steady for 15 seconds to win.",
		],
		topologyGuidance: [
			"Use a Switch to fan-out links so both Users share the Modem fairly.",
			"Keep the Firewall upstream so every packet is inspected once.",
			"Since Users stay fixed, route extra segments to give each a clean lane."
		],
		winConditionId: "baby3_multi_user",
		failConditionId: "baby_generic_satisfaction_or_score",
	},
];
