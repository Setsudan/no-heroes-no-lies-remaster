export type HeroId = string;
export type MonsterId = string;
export type PlayerId = string;

export interface HeroDefinition {
  id: HeroId;
  strength: number;
  defaultSpawnAmount: number;
}

export interface MonsterDefinition {
  id: MonsterId;
  strength: number;
  lootCoins: number;
  lootGems: number;
}

export interface PlayerConfig {
  id: PlayerId;
  userId?: string;
  isBot: boolean;
  displayName: string;
}

export enum GameStatus {
  WaitingForPlayers = "waiting_for_players",
  InProgress = "in_progress",
  Finished = "finished"
}

export interface PlayerState {
  id: PlayerId;
  userId?: string;
  isBot: boolean;
  displayName: string;
  heroId: HeroId;
  life: number;
  coins: number;
  gems: number;
  alive: boolean;
  declaredIdentityHeroId?: HeroId;
  alternateStrengthIsWolf?: boolean;
  lastShootWasCorrect?: boolean;
  caughtLiarThisTurn?: boolean;
}

export interface PendingDraw {
  playerId: PlayerId;
  drawnHeroId: HeroId;
}

export interface GameConfig {
  finalCoinsTarget: number;
  burnedHeroesCount: number;
  activeMonsterSlots: number;
  rngSeed: number;
}

export interface GameState {
  status: GameStatus;
  players: PlayerState[];
  heroDeck: HeroId[];
  heroDiscardPile: HeroId[];
  burnedHeroes: HeroId[];
  lastDiscardedHeroId?: HeroId;
  monsterDeck: MonsterId[];
  monsterDiscardPile: MonsterId[];
  activeMonsters: MonsterId[];
  currentPlayerIndex: number;
  turnNumber: number;
  pendingDraw: PendingDraw | null;
  turnStep: TurnStep;
  turnPath: TurnPath;
  currentPlayerUsedFreePowerThisTurn: boolean;
}

export type TurnStep =
  | "action_choice"
  | "pending_discard"
  | "declare_after_draw"
  | "powers_after_draw"
  | "attack_after_declare"
  | "end_turn";

export type TurnPath = "draw" | "attack" | "demask" | null;

