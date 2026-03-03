import { dbPool } from "../pool";
import { Hero, Monster } from "../schema";
import { HeroDefinition, MonsterDefinition } from "../../game/GameState";

export async function loadHeroDefinitions(): Promise<HeroDefinition[]> {
  const result = await dbPool.query<Hero>("SELECT * FROM heroes ORDER BY id ASC");
  return result.rows.map((row: Hero) => ({
    id: row.id,
    strength: row.strength,
    defaultSpawnAmount: row.default_spawn_amount
  }));
}

export async function loadMonsterDefinitions(): Promise<MonsterDefinition[]> {
  const result = await dbPool.query<Monster>("SELECT * FROM monsters ORDER BY id ASC");
  return result.rows.map((row: Monster) => ({
    id: row.id,
    strength: row.strength,
    lootCoins: row.loot_coins,
    lootGems: row.loot_gems
  }));
}

