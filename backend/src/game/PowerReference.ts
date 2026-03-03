import { ActivePowerName } from "./Powers";
import { loadPowers } from "../db/repositories/powers";
import { Power } from "../db/schema";

export interface PowerDefinition {
  name: ActivePowerName;
  cost: number | null;
  targetType: string;
  isPassive: boolean;
  triggerEvent: string | null;
  description: string;
}

export type PowerDefinitionMap = Map<ActivePowerName, PowerDefinition>;

export async function loadPowerDefinitions(): Promise<PowerDefinitionMap> {
  const rows: Power[] = await loadPowers();
  const map: PowerDefinitionMap = new Map();

  for (const row of rows) {
    if (row.is_passive) {
      continue;
    }

    const name = row.name as ActivePowerName;

    map.set(name, {
      name,
      cost: row.cost,
      targetType: row.target_type,
      isPassive: row.is_passive,
      triggerEvent: row.trigger_event,
      description: row.description
    });
  }

  return map;
}

