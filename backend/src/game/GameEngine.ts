import {
  GameConfig,
  GameState,
  GameStatus,
  HeroDefinition,
  HeroId,
  MonsterDefinition,
  MonsterId,
  PendingDraw,
  PlayerConfig,
  PlayerId,
  PlayerState
} from "./GameState";
import { ActivePowerName, getHeroPrimaryZeroCostPower, playerHasPassive } from "./Powers";
import { PowerDefinitionMap } from "./PowerReference";

class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed || 1;
  }

  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0xffffffff;
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      throw new Error("maxExclusive must be positive");
    }
    return Math.floor(this.next() * maxExclusive);
  }

  shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = this.nextInt(i + 1);
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
  }
}

export interface GameEngineEventBase {
  type: string;
  sessionId: string;
  turnNumber: number;
}

export interface GameStartedEvent extends GameEngineEventBase {
  type: "game_started";
}

export interface DeclareIdentityEvent extends GameEngineEventBase {
  type: "declare_identity";
  playerId: PlayerId;
  heroId: HeroId;
}

export interface StartDrawEvent extends GameEngineEventBase {
  type: "start_draw";
  playerId: PlayerId;
  drawnHeroId: HeroId;
}

export interface ResolveDrawEvent extends GameEngineEventBase {
  type: "resolve_draw";
  playerId: PlayerId;
  keptHeroId: HeroId;
  discardedHeroId: HeroId;
}

export interface AttackMonsterEvent extends GameEngineEventBase {
  type: "attack_monster";
  playerId: PlayerId;
  monsterId: MonsterId;
  success: boolean;
  heroStrength: number;
  monsterStrength: number;
  lootCoins: number;
  lootGems: number;
}

export interface DemaskAttemptEvent extends GameEngineEventBase {
  type: "demask_attempt";
  playerId: PlayerId;
  targetPlayerId: PlayerId;
  guessedHeroId: HeroId;
  success: boolean;
}

export interface EndTurnEvent extends GameEngineEventBase {
  type: "end_turn";
  playerId: PlayerId;
}

export interface AccuseLiarEvent extends GameEngineEventBase {
  type: "accuse_liar";
  playerId: PlayerId;
  targetPlayerId: PlayerId;
  success: boolean;
}

export interface PowerUsedEvent extends GameEngineEventBase {
  type: "power_used";
  playerId: PlayerId;
  power: ActivePowerName;
  payload?: unknown;
}

export type GameEngineEvent =
  | GameStartedEvent
  | DeclareIdentityEvent
  | StartDrawEvent
  | ResolveDrawEvent
  | AttackMonsterEvent
  | DemaskAttemptEvent
  | EndTurnEvent
  | AccuseLiarEvent
  | PowerUsedEvent;

type EventSink = (event: GameEngineEvent) => void;

interface TurnSnapshot {
  state: GameState;
  pendingDuelBonusForPlayerId?: PlayerId;
  pendingDualAttackForPlayerId?: PlayerId;
  randomState: number;
}

export class GameEngine {
  readonly sessionId: string;
  readonly config: GameConfig;
  readonly state: GameState;

  private readonly heroesById: Map<HeroId, HeroDefinition>;
  private readonly monstersById: Map<MonsterId, MonsterDefinition>;
  private readonly powers: PowerDefinitionMap;
  private readonly random: Random;
  private readonly emitEvent?: EventSink;
  private pendingDuelBonusForPlayerId?: PlayerId;
  private pendingDualAttackForPlayerId?: PlayerId;
  private turnStartSnapshot?: TurnSnapshot;

  constructor(params: {
    sessionId: string;
    players: PlayerConfig[];
    heroes: HeroDefinition[];
    monsters: MonsterDefinition[];
    powers: PowerDefinitionMap;
    config: GameConfig;
    eventSink?: EventSink;
  }) {
    if (params.players.length < 2 || params.players.length > 10) {
      throw new Error("Player count must be between 2 and 10");
    }

    this.sessionId = params.sessionId;
    this.config = params.config;
    this.powers = params.powers;
    this.random = new Random(params.config.rngSeed);
    this.emitEvent = params.eventSink;

    this.heroesById = new Map();
    for (const hero of params.heroes) {
      this.heroesById.set(hero.id, hero);
    }

    this.monstersById = new Map();
    for (const monster of params.monsters) {
      this.monstersById.set(monster.id, monster);
    }

    const heroDeck = this.buildHeroDeck(params.heroes);
    this.random.shuffle(heroDeck);

    const burnedHeroes: HeroId[] = [];
    for (let i = 0; i < params.config.burnedHeroesCount && heroDeck.length > 0; i += 1) {
      const burned = heroDeck.shift();
      if (burned) {
        burnedHeroes.push(burned);
      }
    }

    const players: PlayerState[] = params.players.map((p) => {
      const heroId = heroDeck.shift();
      if (!heroId) {
        throw new Error("Not enough hero cards to assign to all players");
      }
      return {
        id: p.id,
        userId: p.userId,
        isBot: p.isBot,
        displayName: p.displayName,
        heroId,
        life: 3,
        coins: 0,
        gems: 0,
        alive: true
      };
    });

    const monsterDeck = this.buildMonsterDeck(params.monsters);
    this.random.shuffle(monsterDeck);

    const activeMonsters: MonsterId[] = [];
    for (let i = 0; i < params.config.activeMonsterSlots; i += 1) {
      const monsterId = this.drawMonster(monsterDeck, []);
      if (monsterId) {
        activeMonsters.push(monsterId);
      }
    }

    const startingPlayerIndex = this.random.nextInt(players.length);

    this.state = {
      status: GameStatus.InProgress,
      players,
      heroDeck,
      heroDiscardPile: [],
      burnedHeroes,
      monsterDeck,
      monsterDiscardPile: [],
      activeMonsters,
      currentPlayerIndex: startingPlayerIndex,
      turnNumber: 1,
      pendingDraw: null
    };

    this.handleTurnStartPassives();
    this.saveTurnStartSnapshot();

    this.pushEvent({
      type: "game_started",
      sessionId: this.sessionId,
      turnNumber: this.state.turnNumber
    });
  }

  getCurrentPlayer(): PlayerState {
    return this.state.players[this.state.currentPlayerIndex];
  }

  declareIdentity(playerId: PlayerId, heroId: HeroId): void {
    const player = this.requireCurrentPlayer(playerId);
    const heroDef = this.heroesById.get(heroId);
    if (!heroDef) {
      throw new Error("Unknown hero id");
    }

    player.declaredIdentityHeroId = heroId;

    this.pushEvent({
      type: "declare_identity",
      sessionId: this.sessionId,
      turnNumber: this.state.turnNumber,
      playerId,
      heroId
    });
  }

  startDraw(playerId: PlayerId): HeroId {
    const player = this.requireCurrentPlayer(playerId);
    if (!player.alive) {
      throw new Error("Dead player cannot act");
    }
    if (player.caughtLiarThisTurn) {
      throw new Error("Player has been caught lying this turn");
    }
    if (this.state.pendingDraw) {
      throw new Error("Draw already in progress");
    }

    const drawnHeroId = this.drawHero();
    if (!drawnHeroId) {
      throw new Error("No hero card available to draw");
    }

    const pending: PendingDraw = {
      playerId,
      drawnHeroId
    };
    this.state.pendingDraw = pending;

    this.pushEvent({
      type: "start_draw",
      sessionId: this.sessionId,
      turnNumber: this.state.turnNumber,
      playerId,
      drawnHeroId
    });

    return drawnHeroId;
  }

  resolveDrawChoice(playerId: PlayerId, keepDrawn: boolean): void {
    const player = this.requireCurrentPlayer(playerId);
    if (!player.alive) {
      throw new Error("Dead player cannot act");
    }
    if (!this.state.pendingDraw || this.state.pendingDraw.playerId !== playerId) {
      throw new Error("No pending draw for this player");
    }

    const pending = this.state.pendingDraw;
    const currentHeroId = player.heroId;
    const drawnHeroId = pending.drawnHeroId;

    let keptHeroId: HeroId;
    let discardedHeroId: HeroId;

    if (keepDrawn) {
      keptHeroId = drawnHeroId;
      discardedHeroId = currentHeroId;
      player.heroId = drawnHeroId;
    } else {
      keptHeroId = currentHeroId;
      discardedHeroId = drawnHeroId;
    }

    this.state.heroDiscardPile.push(discardedHeroId);
    this.state.lastDiscardedHeroId = discardedHeroId;
    this.state.pendingDraw = null;

    this.pushEvent({
      type: "resolve_draw",
      sessionId: this.sessionId,
      turnNumber: this.state.turnNumber,
      playerId,
      keptHeroId,
      discardedHeroId
    });
  }

  attackMonster(playerId: PlayerId, activeMonsterIndex: number): void {
    const player = this.requireCurrentPlayer(playerId);
    if (!player.alive) {
      throw new Error("Dead player cannot act");
    }
    if (player.caughtLiarThisTurn) {
      throw new Error("Player has been caught lying this turn");
    }
    if (activeMonsterIndex < 0 || activeMonsterIndex >= this.state.activeMonsters.length) {
      throw new Error("Invalid monster index");
    }

    const declaredHeroId = player.declaredIdentityHeroId;
    if (!declaredHeroId) {
      throw new Error("Player must declare identity before attacking a monster");
    }

    const identityHero = this.heroesById.get(declaredHeroId);
    if (!identityHero) {
      throw new Error("Unknown declared hero id");
    }

    const monsterId = this.state.activeMonsters[activeMonsterIndex];
    const monster = this.monstersById.get(monsterId);
    if (!monster) {
      throw new Error("Unknown monster id");
    }

    const heroStrength = this.getDeclaredHeroStrength(player, identityHero);
    const monsterStrength = monster.strength;

    let success = false;
    let lootCoins = 0;
    let lootGems = 0;

    if (heroStrength > monsterStrength) {
      success = true;
      lootCoins = monster.lootCoins;
      lootGems = monster.lootGems;

      const isRoyal = playerHasPassive(player, "royal_immunity");
      if (!isRoyal || monsterId === "ghost_king") {
        this.applyCoinsGained(player, lootCoins);
        this.applyGemsGained(player, lootGems);

        if (monsterId === "ghost_king" && this.isRoyalVengeance(player)) {
          const bonusCoins = 2;
          const bonusGems = 5;
          this.applyCoinsGained(player, bonusCoins);
          this.applyGemsGained(player, bonusGems);
          lootCoins += bonusCoins;
          lootGems += bonusGems;
        }
      }
    } else {
      player.life -= 1;
      if (player.life <= 0) {
        player.alive = false;
      }
    }

    this.state.monsterDiscardPile.push(monsterId);
    const replacement = this.drawMonster(this.state.monsterDeck, this.state.monsterDiscardPile);
    if (replacement) {
      this.state.activeMonsters[activeMonsterIndex] = replacement;
    } else {
      this.state.activeMonsters.splice(activeMonsterIndex, 1);
    }

    this.pushEvent({
      type: "attack_monster",
      sessionId: this.sessionId,
      turnNumber: this.state.turnNumber,
      playerId,
      monsterId,
      success,
      heroStrength,
      monsterStrength,
      lootCoins,
      lootGems
    });
  }

  attemptDemask(playerId: PlayerId, targetPlayerId: PlayerId, guessedHeroId: HeroId): void {
    const player = this.requireCurrentPlayer(playerId);
    if (!player.alive) {
      throw new Error("Dead player cannot act");
    }
    if (player.caughtLiarThisTurn) {
      throw new Error("Player has been caught lying this turn");
    }
    if (player.gems < 6) {
      throw new Error("Not enough gems to attempt demask");
    }

    const target = this.findPlayer(targetPlayerId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    if (target.id === player.id) {
      throw new Error("Cannot demask self");
    }

    player.gems -= 6;

    const success = target.heroId === guessedHeroId;
    if (success) {
      target.life -= 1;
      if (target.life <= 0) {
        target.alive = false;
      }

      const oldHeroId = target.heroId;
      const newHeroId = this.drawHero();
      if (!newHeroId) {
        throw new Error("No hero card available for demasked player");
      }
      target.heroId = newHeroId;
      this.state.heroDiscardPile.push(oldHeroId);
      this.state.lastDiscardedHeroId = oldHeroId;
    }

    this.pushEvent({
      type: "demask_attempt",
      sessionId: this.sessionId,
      turnNumber: this.state.turnNumber,
      playerId,
      targetPlayerId,
      guessedHeroId,
      success
    });
  }

  usePower(playerId: PlayerId, power: ActivePowerName, args: any): void {
    const player = this.requireCurrentPlayer(playerId);
    if (!player.alive) {
      throw new Error("Dead player cannot use powers");
    }

    if (player.caughtLiarThisTurn) {
      throw new Error("Player has been caught lying this turn");
    }

    const powerDef = this.powers.get(power);
    if (!powerDef) {
      throw new Error("Unknown power metadata");
    }
    if (powerDef.cost && powerDef.cost > 0) {
      this.ensureGems(player, powerDef.cost);
    }

    this.validatePowerTargets(player, power, args);

    switch (power) {
      case "change_monster":
        this.powerChangeMonster(player, args);
        break;
      case "fight_monster":
        this.powerFightMonster(player, args);
        break;
      case "fight_player_with_discarded_card":
        this.powerFightPlayerWithDiscardedCard(player, args);
        break;
      case "add_strength_to_challenger":
        this.powerAddStrengthToChallenger(player);
        break;
      case "shuffle_heroes_deck":
        this.powerShuffleHeroesDeck(player);
        break;
      case "change_hero":
        this.powerChangeHero(player);
        break;
      case "exchange_gems_with_player":
        this.powerExchangeGemsWithPlayer(player, args);
        break;
      case "exchange_2coins_for_life":
        this.powerExchange2CoinsForLife(player);
        break;
      case "gain_2gems":
        this.powerGain2Gems(player);
        break;
      case "gain_life":
        this.powerGainLife(player);
        break;
      case "see_player_card":
        this.powerSeePlayerCard(player, args);
        break;
      case "remove_coin":
        this.powerRemoveCoin(player, args);
        break;
      case "shoot_player":
        this.powerShootPlayer(player, args);
        break;
      case "all_in":
        this.powerAllIn(player);
        break;
      case "steal_gem":
        this.powerStealGem(player, args);
        break;
      case "parry_this_you_f_casual":
        this.powerParryThis(player, args);
        break;
      case "steal_coin":
        this.powerStealCoin(player, args);
        break;
      case "mimic_power":
        this.powerMimicPower(player, args);
        break;
      case "mimic_hero":
        this.powerMimicHero(player, args);
        break;
      case "dual_attack":
        this.powerDualAttack(player);
        break;
      case "blind_draw":
        this.powerBlindDraw(player, args);
        break;
      case "force_transform":
        this.powerForceTransform(player, args);
        break;
      case "execution":
        this.powerExecution(player, args);
        break;
      case "command_the_dead":
        this.powerCommandTheDead(player, args);
        break;
      default:
        throw new Error("Unsupported power");
    }

    this.pushEvent({
      type: "power_used",
      sessionId: this.sessionId,
      turnNumber: this.state.turnNumber,
      playerId,
      power,
      payload: args
    });
  }

  accuseLiar(accuserId: PlayerId): boolean {
    const accuser = this.findPlayer(accuserId);
    if (!accuser || !accuser.alive) {
      throw new Error("Accuser not found or dead");
    }

    const target = this.getCurrentPlayer();
    if (!target.alive) {
      throw new Error("Current player is dead");
    }
    if (target.id === accuser.id) {
      throw new Error("Player cannot accuse self");
    }
    if (!target.declaredIdentityHeroId) {
      throw new Error("Current player has not declared an identity");
    }

    const liarId = target.id;
    const liar = target.declaredIdentityHeroId !== target.heroId;
    if (liar) {
      this.restoreTurnFromSnapshot(liarId);
    }

    this.pushEvent({
      type: "accuse_liar",
      sessionId: this.sessionId,
      turnNumber: this.state.turnNumber,
      playerId: accuser.id,
      targetPlayerId: target.id,
      success: liar
    });

    return liar;
  }

  endTurn(playerId: PlayerId): void {
    const player = this.requireCurrentPlayer(playerId);
    if (!player.alive) {
      throw new Error("Dead player cannot end turn");
    }

    this.checkForGameEnd();

    this.pushEvent({
      type: "end_turn",
      sessionId: this.sessionId,
      turnNumber: this.state.turnNumber,
      playerId
    });

    if (this.state.status === GameStatus.Finished) {
      return;
    }

    this.state.turnNumber += 1;
    this.state.pendingDraw = null;

    for (const p of this.state.players) {
      p.caughtLiarThisTurn = false;
    }

    let nextIndex = this.state.currentPlayerIndex;
    const playerCount = this.state.players.length;
    for (let i = 0; i < playerCount; i += 1) {
      nextIndex = (nextIndex + 1) % playerCount;
      if (this.state.players[nextIndex].alive) {
        this.state.currentPlayerIndex = nextIndex;
        break;
      }
    }

    this.handleTurnStartPassives();
    this.saveTurnStartSnapshot();
  }

  private buildHeroDeck(heroes: HeroDefinition[]): HeroId[] {
    const deck: HeroId[] = [];
    for (const hero of heroes) {
      for (let i = 0; i < hero.defaultSpawnAmount; i += 1) {
        deck.push(hero.id);
      }
    }
    return deck;
  }

  private buildMonsterDeck(monsters: MonsterDefinition[]): MonsterId[] {
    const deck: MonsterId[] = [];
    for (const monster of monsters) {
      deck.push(monster.id);
    }
    return deck;
  }

  private drawHero(): HeroId | undefined {
    if (this.state.heroDeck.length === 0) {
      if (this.state.heroDiscardPile.length === 0) {
        return undefined;
      }
      this.state.heroDeck = this.state.heroDiscardPile.splice(0);
      this.random.shuffle(this.state.heroDeck);
    }
    return this.state.heroDeck.shift();
  }

  private drawMonster(monsterDeck: MonsterId[], discardPile: MonsterId[]): MonsterId | undefined {
    if (monsterDeck.length === 0) {
      if (discardPile.length === 0) {
        return undefined;
      }
      monsterDeck.push(...discardPile.splice(0));
      this.random.shuffle(monsterDeck);
    }
    return monsterDeck.shift();
  }

  private requireCurrentPlayer(playerId: PlayerId): PlayerState {
    const player = this.getCurrentPlayer();
    if (player.id !== playerId) {
      throw new Error("It is not this player turn");
    }
    return player;
  }

  private findPlayer(playerId: PlayerId): PlayerState | undefined {
    return this.state.players.find((p) => p.id === playerId);
  }

  private checkForGameEnd(): void {
    const alivePlayers = this.state.players.filter((p) => p.alive);
    if (alivePlayers.length === 1) {
      this.state.status = GameStatus.Finished;
      return;
    }

    const winnerByCoins = this.state.players.find(
      (p) => p.coins >= this.config.finalCoinsTarget && p.alive
    );
    if (winnerByCoins) {
      this.state.status = GameStatus.Finished;
    }
  }

  private pushEvent(event: GameEngineEvent): void {
    if (this.emitEvent) {
      this.emitEvent(event);
    }
  }

  private getDeclaredHeroStrength(player: PlayerState, identityHero: HeroDefinition): number {
    let strength = identityHero.strength;

    if (playerHasPassive(player, "alternate_strength")) {
      if (player.alternateStrengthIsWolf) {
        strength = 12;
      } else {
        strength = 5;
      }
    }

    return strength;
  }

  private handleTurnStartPassives(): void {
    const current = this.getCurrentPlayer();

    if (playerHasPassive(current, "alternate_strength")) {
      current.alternateStrengthIsWolf = !current.alternateStrengthIsWolf;
    } else {
      current.alternateStrengthIsWolf = undefined;
    }
  }

  private saveTurnStartSnapshot(): void {
    this.turnStartSnapshot = {
      state: this.cloneGameState(this.state),
      pendingDuelBonusForPlayerId: this.pendingDuelBonusForPlayerId,
      pendingDualAttackForPlayerId: this.pendingDualAttackForPlayerId,
      randomState: this.random.getState()
    };
  }

  private cloneGameState(state: GameState): GameState {
    return {
      status: state.status,
      players: state.players.map((p) => ({ ...p })),
      heroDeck: [...state.heroDeck],
      heroDiscardPile: [...state.heroDiscardPile],
      burnedHeroes: [...state.burnedHeroes],
      lastDiscardedHeroId: state.lastDiscardedHeroId,
      monsterDeck: [...state.monsterDeck],
      monsterDiscardPile: [...state.monsterDiscardPile],
      activeMonsters: [...state.activeMonsters],
      currentPlayerIndex: state.currentPlayerIndex,
      turnNumber: state.turnNumber,
      pendingDraw: state.pendingDraw ? { ...state.pendingDraw } : null
    };
  }

  private restoreGameState(snapshot: GameState): void {
    this.state.status = snapshot.status;
    this.state.players = snapshot.players.map((p) => ({ ...p }));
    this.state.heroDeck = [...snapshot.heroDeck];
    this.state.heroDiscardPile = [...snapshot.heroDiscardPile];
    this.state.burnedHeroes = [...snapshot.burnedHeroes];
    this.state.lastDiscardedHeroId = snapshot.lastDiscardedHeroId;
    this.state.monsterDeck = [...snapshot.monsterDeck];
    this.state.monsterDiscardPile = [...snapshot.monsterDiscardPile];
    this.state.activeMonsters = [...snapshot.activeMonsters];
    this.state.currentPlayerIndex = snapshot.currentPlayerIndex;
    this.state.turnNumber = snapshot.turnNumber;
    this.state.pendingDraw = snapshot.pendingDraw ? { ...snapshot.pendingDraw } : null;
  }

  private restoreTurnFromSnapshot(liarId: PlayerId): void {
    if (!this.turnStartSnapshot) {
      return;
    }

    const snapshot = this.turnStartSnapshot;
    this.restoreGameState(snapshot.state);
    this.pendingDuelBonusForPlayerId = snapshot.pendingDuelBonusForPlayerId;
    this.pendingDualAttackForPlayerId = snapshot.pendingDualAttackForPlayerId;
    this.random.setState(snapshot.randomState);

    const liar = this.findPlayer(liarId);
    if (liar) {
      liar.caughtLiarThisTurn = true;
    }
  }

  private applyCoinsGained(player: PlayerState, amount: number): void {
    if (amount <= 0) {
      return;
    }
    player.coins += amount;
  }

  private applyGemsGained(player: PlayerState, baseAmount: number): void {
    if (baseAmount <= 0) {
      return;
    }

    if (playerHasPassive(player, "teamwork")) {
      player.gems += baseAmount;
    }

    player.gems += baseAmount;

    const prince = this.state.players.find(
      (p) => p.alive && playerHasPassive(p, "tribute") && p.id !== player.id
    );

    if (prince) {
      const tributeAmount = Math.floor(baseAmount / 2);
      if (tributeAmount > 0 && player.gems >= tributeAmount) {
        player.gems -= tributeAmount;
        prince.gems += tributeAmount;
      }
    }
  }

  private isRoyalVengeance(player: PlayerState): boolean {
    return player.declaredIdentityHeroId === "prince" || player.declaredIdentityHeroId === "queen";
  }

  private ensureGems(player: PlayerState, cost: number): void {
    if (player.gems < cost) {
      throw new Error("Not enough gems");
    }
    player.gems -= cost;
  }

  private ensureNotRoyalTarget(target: PlayerState): void {
    if (playerHasPassive(target, "royal_immunity")) {
      throw new Error("Target has royal immunity");
    }
  }

  private validatePowerTargets(
    player: PlayerState,
    power: ActivePowerName,
    args: any
  ): void {
    const def = this.powers.get(power);
    if (!def) {
      return;
    }
    const targetType = def.targetType;
    if (targetType === "self" || targetType === "session") {
      return;
    }
    if (targetType === "other_player") {
      const targetId = String(args?.targetPlayerId ?? "");
      if (!targetId) {
        throw new Error("Missing target player");
      }
      const target = this.findPlayer(targetId);
      if (!target || !target.alive) {
        throw new Error("Target player not found or dead");
      }
      if (target.id === player.id) {
        throw new Error("Target player must be different from self");
      }
      return;
    }
    if (targetType === "monster") {
      const index = Number(args?.index ?? 0);
      if (!Number.isInteger(index)) {
        throw new Error("Invalid monster index");
      }
      if (index < 0 || index >= this.state.activeMonsters.length) {
        throw new Error("Invalid monster index");
      }
    }
  }

  private powerChangeMonster(player: PlayerState, args: any): void {
    const index = Number(args?.index ?? 0);
    if (index < 0 || index >= this.state.activeMonsters.length) {
      throw new Error("Invalid monster index");
    }
    const oldId = this.state.activeMonsters[index];
    const newId = this.drawMonster(this.state.monsterDeck, this.state.monsterDiscardPile);
    if (!newId) {
      throw new Error("No monster available to change");
    }
    this.state.monsterDiscardPile.push(oldId);
    this.state.activeMonsters[index] = newId;
  }

  private powerFightMonster(player: PlayerState, args: any): void {
    const index = Number(args?.index ?? 0);
    this.attackMonster(player.id, index);
  }

  private powerFightPlayerWithDiscardedCard(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const heroId = String(args?.heroId ?? "");
    if (!targetId || !heroId) {
      throw new Error("Missing duel parameters");
    }
    const heroDef = this.heroesById.get(heroId);
    if (!heroDef) {
      throw new Error("Unknown hero from discard");
    }
    if (!this.state.heroDiscardPile.includes(heroId)) {
      throw new Error("Hero not in discard pile");
    }
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    const defenderIdentityId = target.declaredIdentityHeroId ?? target.heroId;
    const defenderHero = this.heroesById.get(defenderIdentityId);
    if (!defenderHero) {
      throw new Error("Unknown defender hero");
    }
    let challengerStrength = heroDef.strength;
    if (this.pendingDuelBonusForPlayerId === player.id) {
      challengerStrength += 1;
      this.pendingDuelBonusForPlayerId = undefined;
    }
    const defenderStrength = defenderHero.strength;
    if (challengerStrength > defenderStrength) {
      target.life -= 1;
      if (target.life <= 0) {
        target.alive = false;
      }
    } else if (defenderStrength > challengerStrength) {
      player.life -= 1;
      if (player.life <= 0) {
        player.alive = false;
      }
    }
  }

  private powerAddStrengthToChallenger(player: PlayerState): void {
    this.pendingDuelBonusForPlayerId = player.id;
  }

  private powerShuffleHeroesDeck(player: PlayerState): void {
    if (!player.alive) {
      throw new Error("Dead player cannot act");
    }
    this.state.heroDeck.push(...this.state.heroDiscardPile);
    this.state.heroDiscardPile = [];
    this.random.shuffle(this.state.heroDeck);
    this.state.lastDiscardedHeroId = undefined;
  }

  private powerChangeHero(player: PlayerState): void {
    const newHeroId = this.drawHero();
    if (!newHeroId) {
      throw new Error("No hero card available");
    }
    const oldHeroId = player.heroId;
    player.heroId = newHeroId;
    this.state.heroDiscardPile.push(oldHeroId);
    this.state.lastDiscardedHeroId = oldHeroId;
  }

  private powerExchangeGemsWithPlayer(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    const tmp = player.gems;
    player.gems = target.gems;
    target.gems = tmp;
  }

  private powerExchange2CoinsForLife(player: PlayerState): void {
    if (player.coins < 2) {
      throw new Error("Not enough coins");
    }
    player.coins -= 2;
    player.life += 1;
  }

  private powerGain2Gems(player: PlayerState): void {
    this.applyGemsGained(player, 2);
  }

  private powerGainLife(player: PlayerState): void {
    player.life += 1;
  }

  private powerSeePlayerCard(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    if (playerHasPassive(target, "royal_immunity")) {
      throw new Error("Cannot inspect royal hero");
    }
    // No state change; information will be transmitted via game_event payload.
  }

  private powerRemoveCoin(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    this.ensureNotRoyalTarget(target);
    if (target.coins <= 0) {
      throw new Error("Target has no coins");
    }
    target.coins -= 1;
  }

  private powerShootPlayer(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const guessedHeroId = String(args?.guessedHeroId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    this.ensureNotRoyalTarget(target);
    const success = target.heroId === guessedHeroId;
    player.lastShootWasCorrect = success;
    if (success) {
      target.life -= 1;
      if (target.life <= 0) {
        target.alive = false;
      }
    }
  }

  private powerAllIn(player: PlayerState): void {
    if (player.lastShootWasCorrect) {
      player.gems *= 2;
    } else {
      player.gems = 0;
    }
  }

  private powerStealGem(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    this.ensureNotRoyalTarget(target);
    if (playerHasPassive(target, "keep_gems")) {
      return;
    }
    if (target.gems <= 0) {
      throw new Error("Target has no gems");
    }
    target.gems -= 1;
    this.applyGemsGained(player, 1);
  }

  private powerParryThis(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    this.ensureNotRoyalTarget(target);
    target.life -= 1;
    if (target.life <= 0) {
      target.alive = false;
    }
  }

  private powerStealCoin(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    this.ensureNotRoyalTarget(target);
    if (target.coins <= 0) {
      throw new Error("Target has no coins");
    }
    target.coins -= 1;
    this.applyCoinsGained(player, 1);
  }

  private powerMimicPower(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    const primaryPower = getHeroPrimaryZeroCostPower(target.heroId);
    if (!primaryPower) {
      throw new Error("Target hero has no zero cost power to mimic");
    }
    this.usePower(player.id, primaryPower, args);
  }

  private powerMimicHero(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    player.declaredIdentityHeroId = target.heroId;
  }

  private powerDualAttack(player: PlayerState): void {
    this.pendingDualAttackForPlayerId = player.id;
  }

  private powerBlindDraw(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    const drawn = this.drawHero();
    if (!drawn) {
      throw new Error("No hero card available");
    }
    const keepNew = this.random.nextInt(2) === 0;
    if (keepNew) {
      const old = target.heroId;
      target.heroId = drawn;
      this.state.heroDiscardPile.push(old);
      this.state.lastDiscardedHeroId = old;
    } else {
      this.state.heroDiscardPile.push(drawn);
      this.state.lastDiscardedHeroId = drawn;
    }
  }

  private powerForceTransform(player: PlayerState, args: any): void {
    const targetId = String(args?.targetPlayerId ?? "");
    const target = this.findPlayer(targetId);
    if (!target || !target.alive) {
      throw new Error("Target player not found or dead");
    }
    if (playerHasPassive(target, "royal_immunity")) {
      throw new Error("Target has royal immunity");
    }
    const oldHeroId = target.heroId;
    const newHeroId = this.drawHero();
    if (!newHeroId) {
      throw new Error("No hero card available");
    }
    target.heroId = newHeroId;
    this.state.heroDiscardPile.push(oldHeroId);
    this.state.lastDiscardedHeroId = oldHeroId;
  }

  private powerExecution(player: PlayerState, args: any): void {
    const heroId = String(args?.heroId ?? "");
    if (!heroId) {
      throw new Error("Missing hero id to execute");
    }
    this.state.heroDiscardPile = this.state.heroDiscardPile.filter((h) => h !== heroId);
    this.state.heroDeck = this.state.heroDeck.filter((h) => h !== heroId);
    if (this.state.lastDiscardedHeroId === heroId) {
      this.state.lastDiscardedHeroId = undefined;
    }
  }

  private powerCommandTheDead(player: PlayerState, args: any): void {
    const heroId = String(args?.heroId ?? "");
    const index = Number(args?.index ?? 0);
    if (!heroId) {
      throw new Error("Missing hero id from discard");
    }
    if (!this.state.heroDiscardPile.includes(heroId)) {
      throw new Error("Hero not in discard pile");
    }
    const heroDef = this.heroesById.get(heroId);
    if (!heroDef) {
      throw new Error("Unknown hero");
    }
    if (index < 0 || index >= this.state.activeMonsters.length) {
      throw new Error("Invalid monster index");
    }
    const monsterId = this.state.activeMonsters[index];
    const monster = this.monstersById.get(monsterId);
    if (!monster) {
      throw new Error("Unknown monster");
    }
    const heroStrength = heroDef.strength;
    const monsterStrength = monster.strength;
    let lootCoins = 0;
    let lootGems = 0;
    if (heroStrength > monsterStrength) {
      lootCoins = monster.lootCoins;
      lootGems = monster.lootGems;
      this.applyCoinsGained(player, lootCoins);
      this.applyGemsGained(player, lootGems);
      if (monsterId === "ghost_king" && player.declaredIdentityHeroId === "queen") {
        const bonusCoins = 1;
        const bonusGems = 3;
        this.applyCoinsGained(player, bonusCoins);
        this.applyGemsGained(player, bonusGems);
      }
    } else {
      player.life -= 1;
      if (player.life <= 0) {
        player.alive = false;
      }
    }
    this.state.monsterDiscardPile.push(monsterId);
    const replacement = this.drawMonster(this.state.monsterDeck, this.state.monsterDiscardPile);
    if (replacement) {
      this.state.activeMonsters[index] = replacement;
    } else {
      this.state.activeMonsters.splice(index, 1);
    }
  }
}

