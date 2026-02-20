# Packet Design Specs: New Types

## Overview
This document defines the specifications for three new packet types introduced in the "Packets of Pain" update. These packets introduce new mechanics (stealth, instant failure conditions, and heavy processing chains) to diversify gameplay beyond standard traffic.

## 1. Video Stream Packet (The Bandwidth Hog)
*High value, high resource consumption. Represents 4k streaming data.*

*   **Color:** `#4A90E2` (Bright Blue)
*   **Speed:** Slow (0.5x standard speed) - *Heavy payload moves slowly visually.*
*   **Reward:** $15.00
*   **Damage:** -50 Reputation (User buffering rage)
*   **Processing Chain:**
    1.  `CDN` (Cache hit check)
    2.  `Compute` (Transcoding/Processing)
    3.  `S3` (Storage)
*   **Special Mechanics:**
    *   **Bandwidth Saturation:** While a Video Stream packet is being processed by a node, that node's processing speed for *other* packets is reduced by 30%.
    *   **Fragmentable:** If a node is overloaded, there is a 10% chance this packet splits into 3 smaller "Buffering" packets (Gray, worthless) that just clog the lines further before disappearing.

## 2. SQL Injection Packet (The Stealth Killer)
*Malicious traffic hiding in plain sight. Must be filtered or it damages the database.*

*   **Color:** `#9B59B6` (Amethyst Purple) - *Initially appears as standard HTTP Green (`#2ECC71`) until scanned.*
*   **Speed:** Fast (1.5x standard speed)
*   **Reward:** $5.00 (Bounty for blocking) / -$20.00 (If it hits Database)
*   **Damage:** -100 Reputation (Data breach) + Database Node Health -20%
*   **Processing Chain:**
    1.  `WAF` (Web Application Firewall) - *REQUIRED to reveal true type.*
    2.  **IF BLOCKED:** Dissolves instantly (Success).
    3.  **IF MISSED/NO WAF:** Travels to `Database`.
*   **Special Mechanics:**
    *   **Mimicry:** Spawns looking exactly like a standard API Request (Green).
    *   **WAF RNG:**
        *   Level 1 WAF: 60% chance to detect & block.
        *   Level 2 WAF: 80% chance to detect & block.
        *   Level 3 WAF: 100% chance to detect & block.
    *   *Visual Cue:* If not detected, it turns Purple only the moment it hits the Database (too late!).

## 3. Heartbeat Packet (The Fragile Ping)
*System health checks. Low value but critical for uptime stats. Zero tolerance for latency.*

*   **Color:** `#F1C40F` (Sunflower Yellow)
*   **Speed:** Very Fast (2.0x standard speed)
*   **Reward:** $1.00
*   **Damage:** -10 Reputation (Immediate "Service Down" flag)
*   **Processing Chain:**
    1.  `HealthCheck` (Entry)
    2.  `ALB` (Load Balancer)
*   **Special Mechanics:**
    *   **TTL (Time To Live):** Extremely short timeout. If this packet remains in any queue (buffer) for more than 2.0 seconds total, it instantly "times out" (dies) and applies the penalty.
    *   **Priority:** Should be prioritized by smart routers, but standard routers might treat it same as bulk traffic, leading to failures during congestion.

## Summary Table

| Type | Hex | Speed | Chain | Reward | Penalty | Special |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Video** | `#4A90E2` | Slow | CDN -> Comp -> S3 | $15 | -50 Rep | Slows node processing; Can fragment. |
| **SQLi** | `#9B59B6` | Fast | WAF (or DB) | $5 | -100 Rep | Camouflaged as normal traffic; Damages DB health. |
| **Heartbeat**| `#F1C40F` | V.Fast| Health -> ALB | $1 | -10 Rep | Dies if queued > 2s. |
