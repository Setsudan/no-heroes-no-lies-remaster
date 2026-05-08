import { strict as assert } from "assert";
import { GameEngine } from "./GameEngine";
import { GameConfig, GameStatus, HeroDefinition, MonsterDefinition, PlayerConfig } from "./GameState";

function createTestEngine(playerCount: number): GameEngine {
  const heroes: HeroDefinition[] = [
    { id: "troll", strength: 7, defaultSpawnAmount: 2 },
    { id: "elf", strength: 8, defaultSpawnAmount: 2 }
  ];
  const monsters: MonsterDefinition[] = [
    { id: "skeleton", strength: 5, lootCoins: 1, lootGems: 1 },
    { id: "wyvern", strength: 6, lootCoins: 1, lootGems: 2 }
  ];
  const players: PlayerConfig[] = [];
  for (let i = 0; i < playerCount; i += 1) {
    players.push({
      id: `p${i + 1}`,
      isBot: false,
      displayName: `Player ${i + 1}`
    });
  }
  const config: GameConfig = {
    finalCoinsTarget: playerCount + 1,
    burnedHeroesCount: 1,
    activeMonsterSlots: 2,
    rngSeed: 1
  };
  return new GameEngine({
    sessionId: "test",
    players,
    heroes,
    monsters,
    powers: new Map(),
    config
  });
}

export function basicGameEngineTest(): void {
  const engine = createTestEngine(2);
  const first = engine.state.players[0];
  const second = engine.state.players[1];

  engine.declareIdentity(first.id, first.heroId);
  if (engine.state.activeMonsters.length > 0) {
    engine.attackMonster(first.id, 0);
  }
  second.alive = false;
  engine.endTurn(first.id);

  assert.equal(engine.state.status, GameStatus.Finished);
}

