import type { RecipeDemand } from "./types.js";

export type MissingResult = {
  missingCount: number;
  demandKeys: string[];
  missingKeys: string[];
};

type DemandUnit =
  | { kind: "single"; key: string; ingredientId: string }
  | { kind: "either"; key: string; ingredientIds: string[] };

function buildDemandUnits(demands: readonly RecipeDemand[]): DemandUnit[] {
  const units: DemandUnit[] = [];
  const singleSeen = new Set<string>();
  const eitherGroups = new Map<string, string[]>();

  for (const demand of demands) {
    if (demand.role === "garnish" || demand.role === "optional") continue;

    if (demand.role === "either") {
      const groupId = demand.eitherGroupId;
      if (!groupId) {
        // Defensive: treat as single required if group missing
        if (!singleSeen.has(demand.ingredientId)) {
          singleSeen.add(demand.ingredientId);
          units.push({
            kind: "single",
            key: `req:${demand.ingredientId}`,
            ingredientId: demand.ingredientId,
          });
        }
        continue;
      }
      const list = eitherGroups.get(groupId) ?? [];
      list.push(demand.ingredientId);
      eitherGroups.set(groupId, list);
      continue;
    }

    // required
    if (singleSeen.has(demand.ingredientId)) continue;
    singleSeen.add(demand.ingredientId);
    units.push({
      kind: "single",
      key: `req:${demand.ingredientId}`,
      ingredientId: demand.ingredientId,
    });
  }

  for (const [groupId, ingredientIds] of eitherGroups) {
    units.push({
      kind: "either",
      key: `either:${groupId}`,
      ingredientIds: [...new Set(ingredientIds)],
    });
  }

  return units;
}

export function computeMissingCount(input: {
  demands: readonly RecipeDemand[];
  satisfiedIds: ReadonlySet<string>;
}): MissingResult {
  const units = buildDemandUnits(input.demands);
  const missingKeys: string[] = [];

  for (const unit of units) {
    if (unit.kind === "single") {
      if (!input.satisfiedIds.has(unit.ingredientId)) missingKeys.push(unit.key);
    } else if (!unit.ingredientIds.some((id) => input.satisfiedIds.has(id))) {
      missingKeys.push(unit.key);
    }
  }

  return {
    missingCount: missingKeys.length,
    demandKeys: units.map((u) => u.key),
    missingKeys,
  };
}
