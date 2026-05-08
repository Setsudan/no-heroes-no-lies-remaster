import { Client, Room } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { GameEngine, GameEngineEvent } from "../game/GameEngine";
import {
  GameConfig,
  GameStatus,
  HeroDefinition,
  MonsterDefinition,
  PlayerConfig,
  PlayerId
} from "../game/GameState";
import { loadHeroDefinitions, loadMonsterDefinitions } from "../db/repositories/reference";
import { loadPowerDefinitions, PowerDefinitionMap } from "../game/PowerReference";
import { verifyAccessToken } from "../utils/auth";
import { findUserById } from "../db/repositories/users";
import * as guestTracker from "./guestTracker";
import { appendGameEvent } from "../game/Logging";
import { SimpleBot } from "../bots/SimpleBot";

class PlayerPublicState extends Schema {
  @type("string")
  id: string = "";

  @type("string")
  displayName: string = "";

  @type("boolean")
  alive: boolean = true;

  @type("number")
  life: number = 3;

  @type("number")
  coins: number = 0;

  @type("number")
  gems: number = 0;

  @type("string")
  declaredIdentityHeroId: string = "";
}

class NoHeroesRoomState extends Schema {
  @type({ map: PlayerPublicState })
  players = new MapSchema<PlayerPublicState>();

  @type("string")
  currentPlayerId: string = "";

  @type("number")
  turnNumber: number = 0;

  @type(["string"])
  activeMonsters = new ArraySchema<string>();

  @type("string")
  lastDiscardedHeroId: string = "";

  @type("string")
  turnStep: string = "action_choice";

  @type("boolean")
  currentPlayerHasPendingDraw: boolean = false;

  @type("string")
  ownerPlayerId: string = "";
}

interface JoinOptions {
  sessionId?: string;
  token?: string;
  displayName?: string;
  burnedHeroesCount?: number;
}

export class NoHeroesRoom extends Room {
  private sessionId: string = "";
  private heroDefinitions: HeroDefinition[] = [];
  private monsterDefinitions: MonsterDefinition[] = [];
  private powerDefinitions: PowerDefinitionMap = new Map();
  private engine: GameEngine | null = null;
  private pendingPlayers: PlayerConfig[] = [];
  private burnedHeroesCount: number = 1;
  private ownerPlayerId: PlayerId | null = null;
  private botController = new SimpleBot();
  private challengeTimeoutRef: any = null;
  private clientSessionIdToGuestUserId = new Map<string, string>();

  private get roomState(): NoHeroesRoomState {
    return this.state as NoHeroesRoomState;
  }

  async onCreate(options: JoinOptions): Promise<void> {
    this.sessionId = String(options.sessionId ?? this.roomId);
    this.burnedHeroesCount =
      typeof options.burnedHeroesCount === "number" && options.burnedHeroesCount > 0
        ? options.burnedHeroesCount
        : 1;

    this.maxClients = 10;
    this.setState(new NoHeroesRoomState());

    this.heroDefinitions = await loadHeroDefinitions();
    this.monsterDefinitions = await loadMonsterDefinitions();
    this.powerDefinitions = await loadPowerDefinitions();

    this.onMessage("start_game", (client) => {
      this.handleStartGame(client);
    });

    this.onMessage("declare_identity", (client, message: { heroId: string }) => {
      this.handleDeclareIdentity(client, message);
    });

    this.onMessage("start_draw", (client) => {
      this.handleStartDraw(client);
    });

    this.onMessage("resolve_draw", (client, message: { keepDrawn: boolean }) => {
      this.handleResolveDraw(client, message);
    });

    this.onMessage("attack_monster", (client, message: { index: number }) => {
      this.handleAttackMonster(client, message);
    });

    this.onMessage(
      "demask",
      (client, message: { targetPlayerId: string; guessedHeroId: string }) => {
        this.handleDemask(client, message);
      }
    );

    this.onMessage("end_turn", (client) => {
      this.handleEndTurn(client);
    });

    this.onMessage(
      "use_power",
      (client, message: { power: string; args?: unknown }) => {
        this.handleUsePower(client, message);
      }
    );

    this.onMessage("accuse_liar", (client) => {
      this.handleAccuseLiar(client);
    });
  }

  async onJoin(client: Client, options: JoinOptions): Promise<void> {
    if (this.engine && this.engine.state.status === GameStatus.InProgress) {
      client.leave(1001, "Game already started");
      return;
    }

    let userId: string | undefined;
    if (options.token) {
      try {
        const payload = verifyAccessToken(options.token);
        userId = payload.sub;
      } catch {
        // Anonymous join if token invalid
      }
    }

    if (userId) {
      const user = await findUserById(userId);
      if (user?.is_guest) {
        guestTracker.recordJoin(userId, client.sessionId);
        this.clientSessionIdToGuestUserId.set(client.sessionId, userId);
      }
    }

    const displayName =
      typeof options.displayName === "string" && options.displayName.trim().length > 0
        ? options.displayName.trim()
        : `Player-${client.sessionId.slice(0, 6)}`;

    const playerConfig: PlayerConfig = {
      id: client.sessionId,
      userId,
      isBot: false,
      displayName
    };

    this.pendingPlayers.push(playerConfig);

    if (!this.ownerPlayerId) {
      this.ownerPlayerId = playerConfig.id;
    }

    this.roomState.ownerPlayerId = this.ownerPlayerId ?? "";

    const playerState = new PlayerPublicState();
    playerState.id = playerConfig.id;
    playerState.displayName = playerConfig.displayName;
    this.roomState.players.set(playerConfig.id, playerState);
  }

  onLeave(client: Client): void {
    const playerId = client.sessionId;

    const guestUserId = this.clientSessionIdToGuestUserId.get(playerId);
    if (guestUserId) {
      this.clientSessionIdToGuestUserId.delete(playerId);
      guestTracker.recordLeave(guestUserId, playerId);
    }

    if (!this.engine) {
      this.pendingPlayers = this.pendingPlayers.filter((p) => p.id !== playerId);

      if (this.ownerPlayerId === playerId) {
        this.ownerPlayerId = this.pendingPlayers.length > 0 ? this.pendingPlayers[0].id : null;
        this.roomState.ownerPlayerId = this.ownerPlayerId ?? "";
      }
    }

    const publicState = this.roomState.players.get(playerId);
    if (publicState) {
      publicState.alive = false;
    }
  }

  onDispose(): void {
    this.engine = null;
  }

  private handleStartGame(client: Client): void {
    if (this.engine) {
      return;
    }

    if (this.ownerPlayerId && client.sessionId !== this.ownerPlayerId) {
      client.send("error", { code: 4001, message: "Only the game master can start the game" });
      return;
    }

    const totalPlayers = this.pendingPlayers.length;
    if (totalPlayers < 2 || totalPlayers > 10) {
      return;
    }

    const finalCoinsTarget = totalPlayers + 1;

    const gameConfig: GameConfig = {
      finalCoinsTarget,
      burnedHeroesCount: this.burnedHeroesCount,
      activeMonsterSlots: 2,
      rngSeed: Date.now()
    };

    this.engine = new GameEngine({
      sessionId: this.sessionId,
      players: this.pendingPlayers,
      heroes: this.heroDefinitions,
      monsters: this.monsterDefinitions,
      powers: this.powerDefinitions,
      config: gameConfig,
      eventSink: (event: GameEngineEvent) => {
        this.broadcast("game_event", event);
        appendGameEvent(this.sessionId, event).catch(() => {
          // Swallow logging errors to avoid breaking gameplay
        });
        if (event.type === "attack_monster") {
          if (event.monsterId !== "ghost_king") {
            this.openChallengeWindow();
          }
        }
      }
    });

    this.syncStateFromEngine();
    this.maybeTriggerBotTurn();
  }

  private handleDeclareIdentity(client: Client, message: { heroId: string }): void {
    if (!this.engine) {
      return;
    }
    try {
      this.engine.declareIdentity(client.sessionId, message.heroId);
      this.syncStateFromEngine();
    } catch (err) {
      client.send("error", { code: 4002, message: (err as Error).message });
    }
  }

  private handleStartDraw(client: Client): void {
    if (!this.engine) {
      return;
    }
    try {
      const drawnHeroId = this.engine.startDraw(client.sessionId);
      this.syncStateFromEngine();
      client.send("draw_result", { heroId: drawnHeroId });
    } catch (err) {
      client.send("error", { code: 4002, message: (err as Error).message });
    }
  }

  private handleResolveDraw(client: Client, message: { keepDrawn: boolean }): void {
    if (!this.engine) {
      return;
    }
    try {
      this.engine.resolveDrawChoice(client.sessionId, message.keepDrawn);
      this.syncStateFromEngine();
    } catch (err) {
      client.send("error", { code: 4002, message: (err as Error).message });
    }
  }

  private handleAttackMonster(client: Client, message: { index: number }): void {
    if (!this.engine) {
      return;
    }
    try {
      this.engine.attackMonster(client.sessionId, message.index);
      this.syncStateFromEngine();
    } catch (err) {
      client.send("error", { code: 4002, message: (err as Error).message });
    }
  }

  private handleDemask(client: Client, message: { targetPlayerId: string; guessedHeroId: string }): void {
    if (!this.engine) {
      return;
    }
    try {
      this.engine.attemptDemask(client.sessionId, message.targetPlayerId, message.guessedHeroId);
      this.syncStateFromEngine();
    } catch (err) {
      client.send("error", { code: 4002, message: (err as Error).message });
    }
  }

  private handleEndTurn(client: Client): void {
    if (!this.engine) {
      return;
    }
    try {
      this.engine.endTurn(client.sessionId);
      this.syncStateFromEngine();
      this.maybeTriggerBotTurn();
      this.clearChallengeWindow();
    } catch (err) {
      client.send("error", { code: 4002, message: (err as Error).message });
    }
  }

  private handleUsePower(
    client: Client,
    message: {
      power: string;
      args?: unknown;
    }
  ): void {
    if (!this.engine) {
      return;
    }
    try {
      this.engine.usePower(client.sessionId, message.power as any, message.args);
      this.syncStateFromEngine();
    } catch (err) {
      client.send("error", { code: 4002, message: (err as Error).message });
    }
  }

  private handleAccuseLiar(client: Client): void {
    if (!this.engine) {
      return;
    }
    try {
      const success = this.engine.accuseLiar(client.sessionId);
      this.syncStateFromEngine();
      client.send("accuse_result", { success });
    } catch (err) {
      client.send("error", { code: 4002, message: (err as Error).message });
    }
  }

  private openChallengeWindow(): void {
    if (!this.engine) {
      return;
    }
    if (this.challengeTimeoutRef) {
      this.challengeTimeoutRef.clear();
    }
    this.challengeTimeoutRef = this.clock.setTimeout(() => {
      this.resolveChallengeWindow();
    }, 10000);
  }

  private clearChallengeWindow(): void {
    if (this.challengeTimeoutRef) {
      this.challengeTimeoutRef.clear();
      this.challengeTimeoutRef = null;
    }
  }

  private resolveChallengeWindow(): void {
    this.challengeTimeoutRef = null;
    if (!this.engine) {
      return;
    }
    const current = this.engine.getCurrentPlayer();
    if (!current.alive) {
      return;
    }
    if (!current.caughtLiarThisTurn) {
      return;
    }
    try {
      this.engine.endTurn(current.id);
      this.syncStateFromEngine();
      this.maybeTriggerBotTurn();
    } catch {
      // Ignore errors during automatic resolution
    }
  }

  private syncStateFromEngine(): void {
    if (!this.engine) {
      return;
    }

    const engineState = this.engine.state;

    for (const player of engineState.players) {
      let publicState = this.roomState.players.get(player.id);
      if (!publicState) {
        publicState = new PlayerPublicState();
        publicState.id = player.id;
        publicState.displayName = player.displayName;
        this.roomState.players.set(player.id, publicState);
      }
      publicState.alive = player.alive;
      publicState.life = player.life;
      publicState.coins = player.coins;
      publicState.gems = player.gems;
      publicState.declaredIdentityHeroId = player.declaredIdentityHeroId ?? "";
    }

    this.roomState.turnNumber = engineState.turnNumber;
    this.roomState.currentPlayerId = this.engine.getCurrentPlayer().id;

    this.roomState.activeMonsters.splice(0, this.roomState.activeMonsters.length);
    for (const monsterId of engineState.activeMonsters) {
      this.roomState.activeMonsters.push(monsterId);
    }

    this.roomState.lastDiscardedHeroId = engineState.lastDiscardedHeroId ?? "";
    this.roomState.turnStep = engineState.turnStep;
    this.roomState.currentPlayerHasPendingDraw =
      engineState.pendingDraw !== null && engineState.pendingDraw.playerId === this.engine.getCurrentPlayer().id;
    this.roomState.ownerPlayerId = this.ownerPlayerId ?? "";

    for (const client of this.clients) {
      const player = engineState.players.find((p) => p.id === client.sessionId);
      if (player) {
        client.send("private_state", { heroId: player.heroId });
      }
    }
  }

  private maybeTriggerBotTurn(): void {
    if (!this.engine) {
      return;
    }
    const current = this.engine.getCurrentPlayer();
    if (!current.isBot || !current.alive) {
      return;
    }

    this.clock.setTimeout(() => {
      if (!this.engine) {
        return;
      }
      this.botController.playTurn(this.engine);
      this.syncStateFromEngine();
      this.maybeTriggerBotTurn();
    }, 500);
  }
}

