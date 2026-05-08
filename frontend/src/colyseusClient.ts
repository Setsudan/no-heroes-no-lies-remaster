import { Client, Room } from "@colyseus/sdk";

export interface NoHeroesRoomState {
  players:
    | Record<
        string,
        {
          id: string;
          displayName: string;
          alive: boolean;
          life: number;
          coins: number;
          gems: number;
          declaredIdentityHeroId: string;
        }
      >
    | Map<
    string,
    {
      id: string;
      displayName: string;
      alive: boolean;
      life: number;
      coins: number;
      gems: number;
      declaredIdentityHeroId: string;
    }
  >;
  currentPlayerId: string;
  turnNumber: number;
  activeMonsters: string[];
  lastDiscardedHeroId: string;
  turnStep: string;
  currentPlayerHasPendingDraw: boolean;
  ownerPlayerId: string;
}

export type GameEvent =
  | {
      type: "game_started";
      turnNumber: number;
    }
  | {
      type: "declare_identity";
      playerId: string;
      heroId: string;
    }
  | {
      type: "start_draw";
      playerId: string;
      drawnHeroId: string;
    }
  | {
      type: "resolve_draw";
      playerId: string;
      keptHeroId: string;
      discardedHeroId: string;
    }
  | {
      type: "attack_monster";
      playerId: string;
      monsterId: string;
      success: boolean;
      heroStrength: number;
      monsterStrength: number;
      lootCoins: number;
      lootGems: number;
    }
  | {
      type: "demask_attempt";
      playerId: string;
      targetPlayerId: string;
      guessedHeroId: string;
      success: boolean;
    }
  | {
      type: "end_turn";
      playerId: string;
    }
  | {
      type: "accuse_liar";
      playerId: string;
      targetPlayerId: string;
      success: boolean;
    }
  | {
      type: "power_used";
      playerId: string;
      power: string;
      payload?: unknown;
    };

export interface GameClientOptions {
  endpoint?: string;
}

export interface DrawResultMessage {
  heroId: string;
}

export interface AccuseResultMessage {
  success: boolean;
}

export interface PrivateStateMessage {
  heroId: string;
}

export class GameClient {
  private client: Client;
  private room: Room<NoHeroesRoomState> | null = null;

  constructor(options: GameClientOptions = {}) {
    const endpoint =
      options.endpoint ??
      (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
      (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
      "http://localhost:4001";

    this.client = new Client(endpoint);
  }

  async join(options: { name: string; sessionId?: string; token?: string }): Promise<void> {
    const roomName = "no_heroes_room";
    const joinOptions: Record<string, unknown> = {};
    if (options.sessionId) {
      joinOptions.sessionId = options.sessionId;
    }
    if (options.token) {
      joinOptions.token = options.token;
    }
    joinOptions.displayName = options.name;

    this.room = await this.client.joinOrCreate<NoHeroesRoomState>(roomName, joinOptions);
  }

  onStateChange(handler: (state: NoHeroesRoomState) => void): void {
    if (!this.room) {
      return;
    }
    this.room.onStateChange((state) => {
      handler(state as unknown as NoHeroesRoomState);
    });
  }

  onGameEvent(handler: (event: GameEvent) => void): void {
    if (!this.room) {
      return;
    }
    this.room.onMessage("game_event", (message: unknown) => {
      handler(message as GameEvent);
    });
  }

  onError(handler: (code: number, message: string) => void): void {
    if (!this.room) {
      return;
    }
    this.room.onMessage("error", (payload: { code: number; message: string }) => {
      handler(payload.code, payload.message);
    });
  }

  onDrawResult(handler: (payload: DrawResultMessage) => void): void {
    if (!this.room) {
      return;
    }
    this.room.onMessage("draw_result", (payload: DrawResultMessage) => {
      handler(payload);
    });
  }

  onAccuseResult(handler: (payload: AccuseResultMessage) => void): void {
    if (!this.room) {
      return;
    }
    this.room.onMessage("accuse_result", (payload: AccuseResultMessage) => {
      handler(payload);
    });
  }

  onPrivateState(handler: (payload: PrivateStateMessage) => void): void {
    if (!this.room) {
      return;
    }
    this.room.onMessage("private_state", (payload: PrivateStateMessage) => {
      handler(payload);
    });
  }

  get isConnected(): boolean {
    return !!this.room;
  }

  getSessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  async leave(): Promise<void> {
    if (!this.room) {
      return;
    }
    await this.room.leave();
    this.room = null;
  }

  private ensureRoom(): Room {
    if (!this.room) {
      throw new Error("Not connected to room");
    }
    return this.room;
  }

  startGame(): void {
    const room = this.ensureRoom();
    room.send("start_game");
  }

  declareIdentity(heroId: string): void {
    const room = this.ensureRoom();
    room.send("declare_identity", { heroId });
  }

  startDraw(): void {
    const room = this.ensureRoom();
    room.send("start_draw");
  }

  resolveDraw(keepDrawn: boolean): void {
    const room = this.ensureRoom();
    room.send("resolve_draw", { keepDrawn });
  }

  attackMonster(index: number): void {
    const room = this.ensureRoom();
    room.send("attack_monster", { index });
  }

  demask(targetPlayerId: string, guessedHeroId: string): void {
    const room = this.ensureRoom();
    room.send("demask", { targetPlayerId, guessedHeroId });
  }

  endTurn(): void {
    const room = this.ensureRoom();
    room.send("end_turn");
  }

  usePower(power: string, args?: unknown): void {
    const room = this.ensureRoom();
    room.send("use_power", { power, args });
  }

  accuseLiar(): void {
    const room = this.ensureRoom();
    room.send("accuse_liar");
  }
}

