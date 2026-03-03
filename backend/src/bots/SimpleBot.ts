import { GameEngine } from "../game/GameEngine";

export class SimpleBot {
  playTurn(engine: GameEngine): void {
    const player = engine.getCurrentPlayer();
    if (!player.isBot || !player.alive) {
      return;
    }

    if (!player.declaredIdentityHeroId) {
      engine.declareIdentity(player.id, player.heroId);
    }

    if (engine.state.activeMonsters.length > 0) {
      engine.attackMonster(player.id, 0);
    } else {
      try {
        engine.startDraw(player.id);
        engine.resolveDrawChoice(player.id, false);
      } catch {
        // ignore draw errors
      }
    }

    engine.endTurn(player.id);
  }
}

