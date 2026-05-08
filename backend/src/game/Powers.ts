import { HeroId, PlayerState } from "./GameState";

export type ActivePowerName =
  | "change_monster"
  | "fight_monster"
  | "fight_player_with_discarded_card"
  | "add_strength_to_challenger"
  | "shuffle_heroes_deck"
  | "change_hero"
  | "exchange_gems_with_player"
  | "exchange_2coins_for_life"
  | "gain_2gems"
  | "gain_life"
  | "see_player_card"
  | "remove_coin"
  | "shoot_player"
  | "all_in"
  | "steal_gem"
  | "parry_this_you_f_casual"
  | "steal_coin"
  | "mimic_power"
  | "mimic_hero"
  | "dual_attack"
  | "blind_draw"
  | "force_transform"
  | "execution"
  | "command_the_dead";

export type PassivePowerName =
  | "keep_gems"
  | "teamwork"
  | "alternate_strength"
  | "tribute"
  | "royal_immunity";

export function getHeroPassives(heroId: HeroId): PassivePowerName[] {
  switch (heroId) {
    case "geant":
      return ["keep_gems"];
    case "chevalier":
      return ["teamwork"];
    case "werewolf":
      return ["alternate_strength"];
    case "prince":
      return ["tribute"];
    case "queen":
      return ["royal_immunity"];
    default:
      return [];
  }
}

export function playerHasPassive(player: PlayerState, passive: PassivePowerName): boolean {
  const declaredId = player.declaredIdentityHeroId;
  if (!declaredId) {
    return false;
  }
  const passives = getHeroPassives(declaredId);
  return passives.includes(passive);
}

export function getHeroPrimaryZeroCostPower(heroId: HeroId): ActivePowerName | null {
  const p = getHeroPowers(heroId);
  return p.free;
}

export function getHeroPowers(heroId: HeroId): {
  free: ActivePowerName | null;
  paid: ActivePowerName | null;
} {
  switch (heroId) {
    case "troll":
      return { free: "change_monster", paid: "fight_monster" };
    case "esprit":
      return { free: "fight_player_with_discarded_card", paid: "add_strength_to_challenger" };
    case "barde":
      return { free: "shuffle_heroes_deck", paid: "change_hero" };
    case "elf":
      return { free: "exchange_gems_with_player", paid: "exchange_2coins_for_life" };
    case "nain":
      return { free: "gain_2gems", paid: "gain_life" };
    case "mage":
      return { free: "see_player_card", paid: "remove_coin" };
    case "exorciste":
      return { free: "shoot_player", paid: "all_in" };
    case "gobelin":
      return { free: "steal_gem", paid: "steal_gem" };
    case "geant":
      return { free: null, paid: "parry_this_you_f_casual" };
    case "chevalier":
      return { free: null, paid: "steal_coin" };
    case "shapeshifter":
      return { free: "mimic_hero", paid: "mimic_power" };
    case "werewolf":
      return { free: "dual_attack", paid: "dual_attack" };
    case "witch":
      return { free: "blind_draw", paid: "force_transform" };
    case "prince":
      return { free: null, paid: "execution" };
    case "queen":
      return { free: null, paid: "command_the_dead" };
    default:
      return { free: null, paid: null };
  }
}



