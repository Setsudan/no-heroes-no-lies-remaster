import { GameEngine } from "../game/GameEngine";
import { getHeroPowers } from "../game/Powers";

export class SimpleBot {
  playTurn(engine: GameEngine): void {
    const player = engine.getCurrentPlayer();
    if (!player.isBot || !player.alive) {
      return;
    }

    const step = engine.state.turnStep;

    if (step === "action_choice") {
      if (player.gems >= 6 && engine.state.players.filter((p) => p.alive && p.id !== player.id).length > 0) {
        try {
          const others = engine.state.players.filter((p) => p.alive && p.id !== player.id);
          const target = others[0];
          if (target) {
            engine.attemptDemask(player.id, target.id, target.heroId);
            engine.endTurn(player.id);
            return;
          }
        } catch {
          // fall through to draw or attack
        }
      }
      if (engine.state.activeMonsters.length > 0) {
        engine.declareIdentity(player.id, player.heroId);
        return;
      }
      try {
        engine.startDraw(player.id);
        engine.resolveDrawChoice(player.id, false);
        return;
      } catch {
        engine.endTurn(player.id);
        return;
      }
    }

    if (step === "attack_after_declare" && engine.state.activeMonsters.length > 0) {
      engine.attackMonster(player.id, 0);
      engine.endTurn(player.id);
      return;
    }

    if (step === "pending_discard" && engine.state.pendingDraw) {
      engine.resolveDrawChoice(player.id, false);
      return;
    }

    if (step === "declare_after_draw") {
      engine.declareIdentity(player.id, player.heroId);
      return;
    }

    if (step === "powers_after_draw") {
      const heroPowers = getHeroPowers(player.declaredIdentityHeroId ?? "");
      if (!engine.state.currentPlayerUsedFreePowerThisTurn && heroPowers.free) {
        try {
          engine.usePower(player.id, heroPowers.free, { index: 0 });
          return;
        } catch {
          // continue to end turn
        }
      }
      engine.endTurn(player.id);
      return;
    }

    if (step === "end_turn") {
      engine.endTurn(player.id);
    }
  }
}

