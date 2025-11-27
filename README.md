# Packets of Pain - Cloud Chaos Simulator

Packets of Pain is a browser-based 3D strategy/simulation game where you play a freshly-minted “cloud architect” tossed into the deep end of infrastructure design. The job is simple on paper: keep the budget positive, keep reputation intact, and keep your infrastructure from melting when the internet sneezes.

The game teaches real cloud concepts through systems, not lectures. You wire together WAFs, load balancers, compute fleets, databases, and storage while shaping traffic flows (Web, API, Fraud/DDoS). Each tick pushes your design harder. Mistakes become visible the honest way: queues overflow, packets die, reputational shame ensues.

### Core Ideas

* **Traffic has opinions.** Web traffic wants Object Storage. API traffic wants Compute + Database. Fraud wants to ruin your day unless you block it.
* **Systems push back.** Every component has cost, capacity, queues, and failure modes. Mis-routes and bottlenecks punish complacency.
* **Topology is your canvas.** Build conventionally... or get weird. If it’s technically valid, the game lets you try it.
* **Difficulty ramps naturally.** The campaign (“Multi-Domain”) starts with *Baby’s First Network*-a tongue-in-cheek intro to cameras, controls, routing, and the first WAF-to-ALB chain.

### Tech Stack

* Vanilla JavaScript (ES6+)
* Three.js for the 3D world
* Glass-UI overlays with minimal utility CSS
* No backend; everything runs directly via `index.html`

### Status

Actively modularizing the engine, separating campaign logic, simplifying the rendering loop, and expanding node interactions (free-form linking, movable nodes, extended routing rules). Tutorial system under construction.

### Vision

A game that teaches practical cloud and security intuition—capacity, scaling, queues, blast radius, backpressure—without the drudgery of textbooks. Learn by designing, breaking, and fixing.

---