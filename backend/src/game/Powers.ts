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
  switch (heroId) {
    case "troll":
      return "change_monster";
    case "esprit":
      return "fight_player_with_discarded_card";
    case "barde":
      return "shuffle_heroes_deck";
    case "elf":
      return "exchange_gems_with_player";
    case "nain":
      return "gain_2gems";
    case "mage":
      return "see_player_card";
    case "exorciste":
      return "shoot_player";
    case "gobelin":
      return "steal_gem";
    case "witch":
      return "blind_draw";
    case "shapeshifter":
      return "mimic_hero";
    case "werewolf":
      return "dual_attack";
    case "prince":
      return "execution";
    case "queen":
      return "command_the_dead";
    default:
      return null;
  }
}



