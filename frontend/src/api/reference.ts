import { getJson, getText } from "./client";

export interface HeroReference {
  id: string;
  name: string;
  strength: number;
  default_spawn_amount: number;
  rarity: string;
  power1: string | null;
  power2: string | null;
  notes: string | null;
}

export interface MonsterReference {
  id: string;
  name: string;
  strength: number;
  loot_coins: number;
  loot_gems: number;
  rarity: string;
  spawn_rate: number;
}

interface HeroesResponse {
  heroes: HeroReference[];
}

interface MonstersResponse {
  monsters: MonsterReference[];
}

export function getHeroes(): Promise<HeroesResponse> {
  return getJson<HeroesResponse>("/heroes");
}

export function getMonsters(): Promise<MonstersResponse> {
  return getJson<MonstersResponse>("/monsters");
}

export function getRulesMarkdown(): Promise<string> {
  return getText("/rules");
}
