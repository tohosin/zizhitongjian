/**
 * Unified Data Processing
 * 
 * Converts UnifiedKnowledgeBase to formats needed by visualization components.
 * This replaces the per-chunk aggregation with pre-resolved entities.
 */

import type {
  UnifiedKnowledgeBase,
  UnifiedRole,
  UnifiedLocation,
  UnifiedRelation,
  RoleNodeUnified,
  RoleLinkUnified,
  TimelineEventUnified,
  PowerDistributionUnified,
} from '../types/unified';

/**
 * Convert unified roles to visualization nodes
 */
export function unifiedRolesToNodes(
  kb: UnifiedKnowledgeBase,
  juanFilter?: [number, number]
): RoleNodeUnified[] {
  const nodes: RoleNodeUnified[] = [];
  
  for (const role of Object.values(kb.roles)) {
    // Apply juan filter if provided
    if (juanFilter) {
      const [start, end] = juanFilter;
      const inRange = role.juans_appeared.some(j => j >= start && j <= end);
      if (!inRange) continue;
    }
    
    nodes.push({
      id: role.id,
      name: role.canonical_name,
      power: role.primary_power,
      description: role.description,
      appearances: role.total_mentions,
      juans: role.juans_appeared,
      aliases: Array.from(role.all_names).filter(n => n !== role.canonical_name),
      relatedEntities: Array.from(role.related_entities),
    });
  }
  
  // Sort by appearances (most mentioned first)
  return nodes.sort((a, b) => b.appearances - a.appearances);
}

/**
 * Convert unified relations to visualization links
 */
export function unifiedRelationsToLinks(
  kb: UnifiedKnowledgeBase,
  juanFilter?: [number, number]
): RoleLinkUnified[] {
  const links: RoleLinkUnified[] = [];
  
  for (const relation of Object.values(kb.relations)) {
    // Apply juan filter if provided
    if (juanFilter) {
      const [start, end] = juanFilter;
      const inRange = relation.source_juans.some(j => j >= start && j <= end);
      if (!inRange) continue;
    }
    
    // Resolve entity names to role IDs using name_to_role_id mapping
    const sourceId = kb.name_to_role_id[relation.from_entity];
    const targetId = kb.name_to_role_id[relation.to_entity];
    
    // Only include if both entities can be resolved and exist in roles
    if (!sourceId || !targetId || !kb.roles[sourceId] || !kb.roles[targetId]) {
      continue;
    }
    
    links.push({
      source: sourceId,
      target: targetId,
      action: relation.primary_action,
      weight: relation.interaction_count,
      time: relation.first_interaction_time,
      actionTypes: relation.action_types,
      contexts: relation.contexts,
      sourceJuans: relation.source_juans,
    });
  }
  
  return links;
}

/**
 * Convert unified events to timeline format
 */
export function unifiedEventsToTimeline(
  kb: UnifiedKnowledgeBase,
  juanFilter?: [number, number]
): TimelineEventUnified[] {
  const events: TimelineEventUnified[] = [];
  
  for (const event of Object.values(kb.events)) {
    // Apply juan filter if provided
    if (juanFilter) {
      const [start, end] = juanFilter;
      const inRange = event.source_juans.some(j => j >= start && j <= end);
      if (!inRange) continue;
    }
    
    events.push({
      id: event.id,
      name: event.name,
      time: event.time,
      timeNumeric: event.time_start,
      location: event.location,
      participants: Array.from(event.participants),
      description: event.description,
      juan_index: event.source_juans[0] || 0,
      type: 'event',
      significance: event.significance,
      background: event.background,
    });
  }
  
  // Sort by time (earliest first)
  return events.sort((a, b) => {
    if (a.timeNumeric === null && b.timeNumeric === null) return 0;
    if (a.timeNumeric === null) return 1;
    if (b.timeNumeric === null) return -1;
    return a.timeNumeric - b.timeNumeric;
  });
}

/**
 * Calculate power distribution from unified knowledge base
 */
export function calculateUnifiedPowerDistribution(
  kb: UnifiedKnowledgeBase
): PowerDistributionUnified[] {
  const distribution: PowerDistributionUnified[] = [];
  
  for (const [power, roleIds] of Object.entries(kb.power_to_roles)) {
    distribution.push({
      power,
      count: roleIds.length,
      roles: roleIds,
    });
  }
  
  // Sort by count (most roles first)
  return distribution.sort((a, b) => b.count - a.count);
}

/**
 * Get locations from unified knowledge base
 */
export function unifiedLocationsToList(
  kb: UnifiedKnowledgeBase,
  juanFilter?: [number, number]
): UnifiedLocation[] {
  const locations: UnifiedLocation[] = [];
  
  for (const location of Object.values(kb.locations)) {
    // Apply juan filter if provided
    if (juanFilter) {
      const [start, end] = juanFilter;
      const inRange = location.juans_appeared.some(j => j >= start && j <= end);
      if (!inRange) continue;
    }
    
    locations.push(location);
  }
  
  // Sort by mentions
  return locations.sort((a, b) => b.total_mentions - a.total_mentions);
}

/**
 * Search across all entity types
 */
export function searchUnifiedKnowledgeBase(
  kb: UnifiedKnowledgeBase,
  query: string,
  limit: number = 20
): Array<{
  type: 'role' | 'location' | 'event';
  id: string;
  name: string;
  description: string;
  score: number;
}> {
  const results: Array<{
    type: 'role' | 'location' | 'event';
    id: string;
    name: string;
    description: string;
    score: number;
  }> = [];
  
  const queryLower = query.toLowerCase();
  
  // Search roles
  for (const role of Object.values(kb.roles)) {
    let score = 0;
    const nameLower = role.canonical_name.toLowerCase();
    
    // Exact name match
    if (nameLower === queryLower) score += 100;
    // Name contains query
    else if (nameLower.includes(queryLower)) score += 50;
    
    // Alias matches
    for (const alias of role.all_names) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower === queryLower) score += 80;
      else if (aliasLower.includes(queryLower)) score += 30;
    }
    
    // Description contains query
    if (role.description.includes(query)) score += 10;
    
    if (score > 0) {
      results.push({
        type: 'role',
        id: role.id,
        name: role.canonical_name,
        description: role.description,
        score,
      });
    }
  }
  
  // Search locations
  for (const location of Object.values(kb.locations)) {
    let score = 0;
    
    if (location.canonical_name === query) score += 100;
    else if (location.canonical_name.includes(query)) score += 50;
    
    for (const alias of location.all_names) {
      if (alias === query) score += 80;
      else if (alias.includes(query)) score += 30;
    }
    
    if (location.description.includes(query)) score += 10;
    if (location.modern_name.includes(query)) score += 20;
    
    if (score > 0) {
      results.push({
        type: 'location',
        id: location.id,
        name: location.canonical_name,
        description: location.description,
        score,
      });
    }
  }
  
  // Search events
  for (const event of Object.values(kb.events)) {
    let score = 0;
    
    if (event.name === query) score += 100;
    else if (event.name.includes(query)) score += 50;
    
    if (event.description.includes(query)) score += 10;
    
    if (score > 0) {
      results.push({
        type: 'event',
        id: event.id,
        name: event.name,
        description: event.description,
        score,
      });
    }
  }
  
  // Sort by score and return top results
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Resolve any name/alias to canonical ID
 */
export function resolveName(kb: UnifiedKnowledgeBase, name: string): string | null {
  return kb.name_to_role_id[name] || null;
}

/**
 * Get role by name or alias
 */
export function getRoleByName(kb: UnifiedKnowledgeBase, name: string): UnifiedRole | null {
  const id = kb.name_to_role_id[name];
  if (id) {
    return kb.roles[id] || null;
  }
  return null;
}

/**
 * Get all relations for an entity
 */
export function getRelationsForEntity(
  kb: UnifiedKnowledgeBase,
  entityId: string
): UnifiedRelation[] {
  const relations: UnifiedRelation[] = [];
  
  for (const relation of Object.values(kb.relations)) {
    // Resolve entity names to IDs for comparison
    const fromId = kb.name_to_role_id[relation.from_entity];
    const toId = kb.name_to_role_id[relation.to_entity];
    
    if (fromId === entityId || toId === entityId) {
      relations.push(relation);
    }
  }
  
  return relations.sort((a, b) => b.interaction_count - a.interaction_count);
}

/**
 * Get statistics summary
 */
export function getKnowledgeBaseSummary(kb: UnifiedKnowledgeBase): {
  totalRoles: number;
  totalLocations: number;
  totalEvents: number;
  totalRelations: number;
  totalPowers: number;
  juansProcessed: number;
  topPowers: Array<{ power: string; count: number }>;
  mostMentionedRoles: Array<{ name: string; mentions: number }>;
} {
  const powerDistribution = calculateUnifiedPowerDistribution(kb);
  const roles = Object.values(kb.roles).sort((a, b) => b.total_mentions - a.total_mentions);
  
  return {
    totalRoles: kb.total_roles,
    totalLocations: kb.total_locations,
    totalEvents: kb.total_events,
    totalRelations: kb.total_relations,
    totalPowers: Object.keys(kb.power_to_roles).length,
    juansProcessed: kb.juans_processed.length,
    topPowers: powerDistribution.slice(0, 10).map(p => ({ power: p.power, count: p.count })),
    mostMentionedRoles: roles.slice(0, 10).map(r => ({ name: r.canonical_name, mentions: r.total_mentions })),
  };
}
