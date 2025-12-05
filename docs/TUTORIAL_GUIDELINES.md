# Tutorial Writing Guidelines

Guidelines for writing clear, beginner-friendly tutorial content in Packets of Pain.

## Core Principles

### 1. Replace Jargon with Plain Language

| Technical Term | Plain Alternative |
|----------------|-------------------|
| node | device / box |
| packet | message / data |
| topology | network layout / setup |
| wire / tether | connect / link |
| equip (tool) | select / choose |
| anchor | starting point / fixed spot |
| bidirectional | two-way |
| perimeter | outer edge / entry point |
| backend | inner services / core |
| throughput | traffic speed / flow rate |
| latency | delay / travel time |
| spawn | arrive / appear |
| terminate | end / stop at |

### 2. Use Real-World Metaphors

Good tutorials connect abstract concepts to familiar experiences:

- **Packets as delivery trucks**: "Messages travel through your network like delivery trucks on roads. Each device they pass through is like a checkpoint."
- **Modem as front door**: "Your modem is the front door to the internet—everything coming in or going out passes through it."
- **Firewall as security guard**: "A firewall is like a security guard checking IDs. It lets good visitors through and turns away troublemakers."
- **Load balancer as traffic cop**: "A load balancer is like a traffic cop directing cars to different lanes so no single road gets jammed."
- **Database as filing cabinet**: "Think of your database as a giant filing cabinet where all your important records are stored."

### 3. Explain Consequences, Not Just Actions

**Bad**: "Place a Modem between User and Internet."

**Good**: "Place a Modem between User and Internet. Without it, messages have nowhere to go and your users will get frustrated (watch your Satisfaction meter drop!)."

### 4. Progressive Disclosure

Introduce concepts in layers:

1. **First contact**: What is this thing? (one sentence)
2. **Basic use**: How do I use it? (action step)
3. **Why it matters**: What happens if I don't? (consequence)
4. **Advanced tips**: When should I use alternatives? (strategy)

Don't dump all four layers at once. Spread them across tutorial steps.

---

## Before/After Examples

### Example 1: Tool Selection

**Before (Technical)**:
> "Start paused and click the Modem card in the shop to equip it. It's the gateway device we'll build with."

**After (Beginner-Friendly)**:
> "While the game is paused, click the Modem button in the shop panel below. This selects the Modem—your network's front door to the internet."

### Example 2: Making Connections

**Before (Technical)**:
> "Drag from the Modem to the Internet node. Solid lines mean packets can flow."

**After (Beginner-Friendly)**:
> "Click your Modem, then click the Internet (the globe icon). A line appears connecting them—this is the road your messages will travel."

### Example 3: Completing a Circuit

**Before (Technical)**:
> "Now tether the Modem back to your home User so it has two links feeding it."

**After (Beginner-Friendly)**:
> "Now connect your Modem to the User (the person icon). Your Modem needs connections on both sides—one to receive messages from users, one to send them to the internet."

---

## Consequence Templates

Use these patterns to explain why actions matter:

- **If you don't X**: "If you don't connect the Modem to both sides, messages will get stuck and your users will complain."
- **Watch the Y meter**: "Keep an eye on the Satisfaction bar—it drops when messages can't reach their destination."
- **This prevents Z**: "A Firewall blocks bad traffic. Without one, hackers can overwhelm your network."
- **You'll know it's working when**: "You'll know the connection is good when you see messages (colored dots) flowing along the line."

---

## Checklist for New Tutorial Steps

- [ ] No unexplained jargon (check against dictionary above)
- [ ] Includes at least one metaphor or analogy
- [ ] Mentions what happens if player doesn't complete the step
- [ ] Uses "you/your" language (second person)
- [ ] Action verb starts the instruction (Place, Click, Connect, Watch)
- [ ] Short sentences (aim for <20 words each)
- [ ] References visual feedback player should look for

---

## Service-Specific Language Guide

| Service | Metaphor | What it does (plain) |
|---------|----------|---------------------|
| Modem | Front door | Connects your network to the internet |
| Firewall | Security guard | Blocks suspicious traffic |
| WAF | Fraud detector | Catches scam attempts |
| Load Balancer | Traffic cop | Spreads work across multiple servers |
| Compute | Worker | Processes requests and does the actual work |
| Database | Filing cabinet | Stores and retrieves your data |
| Object Storage | Warehouse | Holds large files like images and videos |
| Switch | Hallway | Connects multiple devices together |
