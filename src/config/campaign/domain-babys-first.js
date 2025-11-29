export const BABYS_FIRST_NETWORK_DOMAIN = {
	id: "babys-first-network",
	title: "Baby's First Network",
	subtitle: "Modular tutorial domain",
	description:
		"Take your first steps assembling modems, firewalls, and switches in a guided playground.",
	icon: "🔰",
	order: 0,
};

export const DOMAIN_BABYS_FIRST_LEVELS = [
	{
		id: "baby-1",
		domainId: BABYS_FIRST_NETWORK_DOMAIN.id,
		worldId: "multi-domain",
		title: "Baby's First Network — Level 1",
		subtitle: "Modem Basics",
		description:
			"Place your first modem and create a working link between a user and the internet.",
		startingBudget: 100,
		toolbarWhitelist: ["Select", "Modem", "LinkTool"],
		internetPosition: { x: -18, y: 0, z: 0 },
		preplacedNodes: [
			{ type: "User", id: "user-1", position: { x: -4, y: 0 } },
			{ type: "Internet", id: "inet-1", position: { x: 4, y: 0 } },
		],
		trafficProfile: {
			mode: "simple",
			userToInternetPps: 1,
			maliciousRate: 0,
		},
		instructions: [
			"Use the time controls (pause/play/fast-forward) to slow or speed traffic while you plan.",
			"Watch the Satisfaction meter above the budget; it currently maps to Reputation.",
			"In the shop below, buy the Modem device so you can anchor your topology.",
			"Place the Modem between the User and Internet nodes.",
			"Use the Link tool to chain User → Modem → Internet and keep packets flowing for 10 seconds.",
		],
		winConditionId: "baby1_packets_10s",
		failConditionId: "baby_generic_satisfaction_or_score",
	},
	{
		id: "baby-2",
		domainId: BABYS_FIRST_NETWORK_DOMAIN.id,
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
		winConditionId: "baby2_firewall_blocks",
		failConditionId: "baby_generic_satisfaction_or_score",
	},
	{
		id: "baby-3",
		domainId: BABYS_FIRST_NETWORK_DOMAIN.id,
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
		winConditionId: "baby3_multi_user",
		failConditionId: "baby_generic_satisfaction_or_score",
	},
];
