// src/config/campaign/index.js

import { CAMPAIGN_DOMAINS } from "./domains.js";
import { DOMAIN_BABYS_FIRST_NETWORK_LEVELS } from "./domain-babys-first-network.js";

export { CAMPAIGN_DOMAINS };

export const CAMPAIGN_LEVELS = [
  ...DOMAIN_BABYS_FIRST_NETWORK_LEVELS,
];

const DOMAIN_CACHE = new Map(CAMPAIGN_DOMAINS.map(domain => [domain.id, domain]));
const LEVEL_CACHE = new Map(CAMPAIGN_LEVELS.map(level => [level.id, level]));

export function getDomainById(id) {
  return DOMAIN_CACHE.get(id) || null;
}

export function getLevelsForDomain(domainId) {
  return CAMPAIGN_LEVELS.filter(l => l.domainId === domainId).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
}

export function getLevelById(id) {
  return LEVEL_CACHE.get(id) || null;
}
