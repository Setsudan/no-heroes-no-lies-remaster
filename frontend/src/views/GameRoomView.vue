<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getHeroes, getMonsters, getRulesMarkdown, type HeroReference, type MonsterReference } from "../api/reference";
import {
  GameClient,
  type AccuseResultMessage,
  type DrawResultMessage,
  type GameEvent,
  type NoHeroesRoomState
} from "../colyseusClient";
import { useAuthStore } from "../stores/auth";

type PlayerPublicState = {
  id: string;
  displayName: string;
  alive: boolean;
  life: number;
  coins: number;
  gems: number;
  declaredIdentityHeroId: string;
};

interface PowerOption {
  name: string;
  cost: number;
  targetType: "self" | "other_player" | "monster" | "session";
}

const POWER_OPTIONS: PowerOption[] = [
  { name: "change_monster", cost: 0, targetType: "monster" },
  { name: "fight_monster", cost: 1, targetType: "monster" },
  { name: "fight_player_with_discarded_card", cost: 0, targetType: "other_player" },
  { name: "add_strength_to_challenger", cost: 2, targetType: "session" },
  { name: "shuffle_heroes_deck", cost: 0, targetType: "session" },
  { name: "change_hero", cost: 2, targetType: "self" },
  { name: "exchange_gems_with_player", cost: 0, targetType: "other_player" },
  { name: "exchange_2coins_for_life", cost: 0, targetType: "self" },
  { name: "gain_2gems", cost: 0, targetType: "self" },
  { name: "gain_life", cost: 6, targetType: "self" },
  { name: "see_player_card", cost: 0, targetType: "other_player" },
  { name: "remove_coin", cost: 3, targetType: "other_player" },
  { name: "shoot_player", cost: 0, targetType: "other_player" },
  { name: "all_in", cost: 69, targetType: "self" },
  { name: "steal_gem", cost: 0, targetType: "other_player" },
  { name: "parry_this_you_f_casual", cost: 6, targetType: "other_player" },
  { name: "steal_coin", cost: 5, targetType: "other_player" },
  { name: "mimic_power", cost: 6, targetType: "other_player" },
  { name: "mimic_hero", cost: 0, targetType: "other_player" },
  { name: "dual_attack", cost: 6, targetType: "session" },
  { name: "blind_draw", cost: 0, targetType: "other_player" },
  { name: "force_transform", cost: 4, targetType: "other_player" },
  { name: "execution", cost: 6, targetType: "session" },
  { name: "command_the_dead", cost: 4, targetType: "monster" }
];

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const roomSessionId = computed(() => String(route.params.sessionId ?? ""));
const displayName = computed(() => {
  const fromQuery = String(route.query.displayName ?? "").trim();
  if (fromQuery) {
    return fromQuery;
  }
  return auth.currentUser.value?.username ?? "Player";
});

const client = new GameClient();
const isConnecting = ref(false);
const isConnected = ref(false);
const error = ref<string | null>(null);
const drawResult = ref<DrawResultMessage | null>(null);
const accuseResult = ref<AccuseResultMessage | null>(null);
const eventLog = ref<GameEvent[]>([]);
const myHeroId = ref<string>("");

const state = reactive<{ roomState: NoHeroesRoomState | null }>({
  roomState: null
});

const heroes = ref<HeroReference[]>([]);
const monsters = ref<MonsterReference[]>([]);
const rulesMarkdown = ref("");

const declareHeroId = ref("");
const attackMonsterIndex = ref(0);
const demaskTargetPlayerId = ref("");
const demaskGuessedHeroId = ref("");
const selectedPower = ref("change_monster");
const powerTargetPlayerId = ref("");
const powerMonsterIndex = ref(0);
const powerHeroId = ref("");
const powerGuessedHeroId = ref("");

function toPlayersList(roomState: NoHeroesRoomState | null): PlayerPublicState[] {
  if (!roomState) {
    return [];
  }
  const playersContainer: any = roomState.players;
  const normalized: PlayerPublicState[] = [];

  if (playersContainer && typeof playersContainer.forEach === "function") {
    playersContainer.forEach((value: unknown) => {
      if (value && typeof value === "object" && typeof (value as any).id === "string") {
        normalized.push(value as PlayerPublicState);
      }
    });
    return normalized;
  }

  for (const value of Object.values(playersContainer ?? {})) {
    if (value && typeof value === "object" && typeof (value as any).id === "string") {
      normalized.push(value as PlayerPublicState);
    }
  }

  return normalized;
}

const playersList = computed(() => toPlayersList(state.roomState));
const mySessionId = computed(() => client.getSessionId() ?? "");
const currentPlayerId = computed(() => state.roomState?.currentPlayerId ?? "");
const isMyTurn = computed(() => mySessionId.value !== "" && mySessionId.value === currentPlayerId.value);
const turnStep = computed(() => state.roomState?.turnStep || "action_choice");
const currentPlayerHasPendingDraw = computed(() => state.roomState?.currentPlayerHasPendingDraw ?? false);
const ownerPlayerId = computed(() => state.roomState?.ownerPlayerId ?? "");
const isGameMaster = computed(() => ownerPlayerId.value !== "" && ownerPlayerId.value === mySessionId.value);
const currentPlayer = computed(() => playersList.value.find((p) => p.id === currentPlayerId.value));
const currentPlayerName = computed(() => (currentPlayer.value?.displayName ?? currentPlayerId.value) || "-");
const myPlayer = computed(() => playersList.value.find((p) => p.id === mySessionId.value));
const myGems = computed(() => myPlayer.value?.gems ?? 0);
const heroesById = computed(() => new Map(heroes.value.map((h) => [h.id, h])));
const myHero = computed(() => (myHeroId.value ? heroesById.value.get(myHeroId.value) : null));
const lastDiscardedHero = computed(() =>
  state.roomState?.lastDiscardedHeroId ? heroesById.value.get(state.roomState.lastDiscardedHeroId) : null
);
const currentPlayerDeclaredIdentity = computed(() => currentPlayer.value?.declaredIdentityHeroId ?? "");
const canAccuseLiar = computed(
  () =>
    !isMyTurn.value &&
    currentPlayerDeclaredIdentity.value !== "" &&
    otherPlayers.value.length > 0
);
const declaredHeroPowers = computed(() => {
  if (turnStep.value !== "powers_after_draw" || !isMyTurn.value || !currentPlayerDeclaredIdentity.value) {
    return [];
  }
  const hero = heroesById.value.get(currentPlayerDeclaredIdentity.value);
  if (!hero) return [];
  const opts: PowerOption[] = [];
  if (hero.power1) {
    const def = POWER_OPTIONS.find((p) => p.name === hero.power1);
    if (def) opts.push(def);
  }
  if (hero.power2 && hero.power2 !== hero.power1) {
    const def = POWER_OPTIONS.find((p) => p.name === hero.power2);
    if (def) opts.push(def);
  }
  return opts;
});

const monstersById = computed(() => new Map(monsters.value.map((monster) => [monster.id, monster])));

const activeMonsters = computed<string[]>(() =>
  Array.from((state.roomState?.activeMonsters as any) ?? []).map((value) => String(value))
);

const selectedPowerDef = computed(() => POWER_OPTIONS.find((power) => power.name === selectedPower.value));

const otherPlayers = computed(() =>
  playersList.value.filter((player) => player.id !== mySessionId.value && player.alive)
);

function appendEvent(event: GameEvent): void {
  eventLog.value.unshift(event);
  if (eventLog.value.length > 100) {
    eventLog.value.length = 100;
  }
}

function eventTurn(event: GameEvent): number {
  if ("turnNumber" in event && typeof event.turnNumber === "number") {
    return event.turnNumber;
  }
  return 0;
}

async function connectToRoom(): Promise<void> {
  if (!roomSessionId.value) {
    error.value = "Missing room session id";
    return;
  }
  isConnecting.value = true;
  error.value = null;
  try {
    const authToken = auth.token.value ?? localStorage.getItem("nhnl.auth.token") ?? undefined;
    await client.join({
      name: displayName.value,
      sessionId: roomSessionId.value,
      token: authToken
    });
    client.onStateChange((roomState) => {
      state.roomState = roomState;
    });
    client.onGameEvent((event) => {
      appendEvent(event);
    });
    client.onError((code, message) => {
      error.value = `Error ${code}: ${message}`;
    });
    client.onDrawResult((payload) => {
      drawResult.value = payload;
    });
    client.onAccuseResult((payload) => {
      accuseResult.value = payload;
    });
    client.onPrivateState((payload) => {
      myHeroId.value = payload.heroId ?? "";
    });
    isConnected.value = true;
  } catch (err) {
    error.value = (err as Error).message || "Failed to connect to room";
  } finally {
    isConnecting.value = false;
  }
}

async function loadReferenceData(): Promise<void> {
  try {
    const [heroesResponse, monstersResponse, rules] = await Promise.all([
      getHeroes(),
      getMonsters(),
      getRulesMarkdown()
    ]);
    heroes.value = heroesResponse.heroes;
    monsters.value = monstersResponse.monsters;
    rulesMarkdown.value = rules;
  } catch (err) {
    error.value = (err as Error).message || "Failed to load reference data";
  }
}

async function leaveRoom(): Promise<void> {
  await client.leave();
  await router.push({ name: "lobbies" });
}

function startGame(): void {
  error.value = null;
  client.startGame();
}

function declareIdentity(): void {
  if (!declareHeroId.value) {
    error.value = "Select a hero identity first";
    return;
  }
  error.value = null;
  client.declareIdentity(declareHeroId.value);
}

function startDraw(): void {
  error.value = null;
  client.startDraw();
}

function resolveDraw(keepDrawn: boolean): void {
  error.value = null;
  client.resolveDraw(keepDrawn);
}

function attackMonster(): void {
  error.value = null;
  client.attackMonster(attackMonsterIndex.value);
}

function demask(): void {
  if (!demaskTargetPlayerId.value || !demaskGuessedHeroId.value) {
    error.value = "Demask requires target player and guessed hero";
    return;
  }
  error.value = null;
  client.demask(demaskTargetPlayerId.value, demaskGuessedHeroId.value);
}

function usePower(): void {
  const def = selectedPowerDef.value;
  if (!def) {
    error.value = "Unknown power";
    return;
  }

  let args: Record<string, unknown> | undefined;
  if (def.targetType === "other_player") {
    if (!powerTargetPlayerId.value) {
      error.value = "Select a target player for this power";
      return;
    }
    args = { targetPlayerId: powerTargetPlayerId.value };
    if (selectedPower.value === "shoot_player") {
      if (!powerGuessedHeroId.value) {
        error.value = "shoot_player requires guessed hero";
        return;
      }
      args.guessedHeroId = powerGuessedHeroId.value;
    }
    if (selectedPower.value === "fight_player_with_discarded_card") {
      if (!powerHeroId.value) {
        error.value = "fight_player_with_discarded_card requires discard hero id";
        return;
      }
      args.heroId = powerHeroId.value;
    }
  }

  if (def.targetType === "monster") {
    args = { index: powerMonsterIndex.value };
    if (selectedPower.value === "command_the_dead") {
      if (!powerHeroId.value) {
        error.value = "command_the_dead requires discard hero id";
        return;
      }
      args.heroId = powerHeroId.value;
    }
  }

  if (selectedPower.value === "execution") {
    if (!powerHeroId.value) {
      error.value = "execution requires hero id";
      return;
    }
    args = { heroId: powerHeroId.value };
  }

  error.value = null;
  client.usePower(selectedPower.value, args);
}

function accuseLiar(): void {
  error.value = null;
  client.accuseLiar();
}

function endTurn(): void {
  error.value = null;
  client.endTurn();
}

onMounted(async () => {
  await Promise.all([connectToRoom(), loadReferenceData()]);
});

watch(
  () => [turnStep.value, declaredHeroPowers.value] as const,
  () => {
    if (turnStep.value === "powers_after_draw" && declaredHeroPowers.value.length > 0) {
      const names = declaredHeroPowers.value.map((p) => p.name);
      const first = names[0];
      if (first && !names.includes(selectedPower.value)) {
        selectedPower.value = first;
      }
    }
  }
);

onUnmounted(() => {
  client.leave().catch(() => {
    // ignore leave failures during unmount
  });
});
</script>

<template>
  <section class="room-page">
    <header class="page-header">
      <h2>Game Room {{ roomSessionId }}</h2>
      <button type="button" @click="leaveRoom">Leave Room</button>
    </header>

    <p class="status">
      <strong>Status:</strong>
      {{ isConnected ? "connected" : isConnecting ? "connecting..." : "disconnected" }}
    </p>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="turn-banner" :class="{ 'turn-banner--mine': isMyTurn }">
      <strong v-if="isMyTurn">Your turn</strong>
      <template v-else>Current turn: <strong>{{ currentPlayerName }}</strong></template>
      <span class="turn-banner-step">({{ turnStep }})</span>
    </div>

    <div class="your-card panel">
      <h3>Your card</h3>
      <p class="your-card-name">{{ myHero ? myHero.name : (myHeroId || "—") }}</p>
      <p v-if="myHero" class="your-card-meta">STR {{ myHero.strength }} · {{ myHero.power1 || "-" }} / {{ myHero.power2 || "-" }}</p>
    </div>

    <div class="grid">
      <div class="panel">
        <h3>Board</h3>
        <p>Turn: <strong>{{ state.roomState?.turnNumber ?? 0 }}</strong></p>
        <p>
          Current player:
          <strong>{{ currentPlayerName }}</strong>
          <span v-if="isMyTurn"> (you)</span>
        </p>
        <p>Last discarded: <strong>{{ lastDiscardedHero ? lastDiscardedHero.name : (state.roomState?.lastDiscardedHeroId || "-") }}</strong></p>
        <h4>Active Monsters</h4>
        <ul>
          <li v-for="(monsterId, idx) in activeMonsters" :key="monsterId + idx">
            #{{ idx }} -
            {{ monstersById.get(monsterId)?.name || monsterId }}
            ({{ monsterId }}, STR {{ monstersById.get(monsterId)?.strength ?? "?" }})
          </li>
        </ul>
      </div>

      <div class="panel">
        <h3>Players</h3>
        <table class="players-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Alive</th>
              <th>Life</th>
              <th>Coins</th>
              <th>Gems</th>
              <th>Declared Identity</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="player in playersList" :key="player.id">
              <td>{{ player.displayName }}</td>
              <td>{{ player.alive ? "yes" : "no" }}</td>
              <td>{{ player.life }}</td>
              <td>{{ player.coins }}</td>
              <td>{{ player.gems }}</td>
              <td>{{ player.declaredIdentityHeroId ? (heroesById.get(player.declaredIdentityHeroId)?.name ?? player.declaredIdentityHeroId) : "-" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h3>Actions</h3>
      <div class="actions-grid">
        <div class="block" v-if="!state.roomState?.turnNumber || state.roomState?.turnNumber < 1">
          <h4>Lobby</h4>
          <button v-if="isGameMaster" type="button" @click="startGame">Start game</button>
          <p v-else>Waiting for the game master to start the game.</p>
        </div>

        <template v-if="(state.roomState?.turnNumber ?? 0) >= 1">
          <div v-if="canAccuseLiar" class="block">
            <h4>Other players</h4>
            <button type="button" @click="accuseLiar">Accuse current player of lying</button>
          </div>

          <template v-if="isMyTurn">
            <div v-if="turnStep === 'action_choice'" class="block">
              <h4>Choose your action</h4>
              <button type="button" @click="startDraw">Draw a card</button>
              <div class="block-inline">
                <span>Or declare identity then attack:</span>
                <select v-model="declareHeroId">
                  <option value="">Select hero</option>
                  <option v-for="hero in heroes" :key="hero.id" :value="hero.id">
                    {{ hero.name }} (STR {{ hero.strength }})
                  </option>
                </select>
                <button type="button" :disabled="!declareHeroId" @click="declareIdentity">Declare then attack</button>
              </div>
              <div class="block-inline">
                <span>Or demask (6 gems):</span>
                <select v-model="demaskTargetPlayerId">
                  <option value="">Target</option>
                  <option v-for="player in otherPlayers" :key="player.id" :value="player.id">{{ player.displayName }}</option>
                </select>
                <select v-model="demaskGuessedHeroId">
                  <option value="">Guessed hero</option>
                  <option v-for="hero in heroes" :key="hero.id" :value="hero.id">{{ hero.name }}</option>
                </select>
                <button type="button" :disabled="myGems < 6 || !demaskTargetPlayerId || !demaskGuessedHeroId" @click="demask">Demask</button>
              </div>
            </div>

            <div v-else-if="currentPlayerHasPendingDraw" class="block">
              <h4>Discard one of two cards</h4>
              <p class="action-hint">You drew a card. Choose which to keep.</p>
              <button type="button" @click="resolveDraw(true)">Keep drawn card</button>
              <button type="button" @click="resolveDraw(false)">Keep current card</button>
            </div>

            <div v-else-if="turnStep === 'declare_after_draw'" class="block">
              <h4>Declare identity</h4>
              <select v-model="declareHeroId">
                <option value="">Select hero</option>
                <option v-for="hero in heroes" :key="hero.id" :value="hero.id">
                  {{ hero.name }} (STR {{ hero.strength }})
                </option>
              </select>
              <button type="button" :disabled="!declareHeroId" @click="declareIdentity">Declare</button>
            </div>

            <div v-else-if="turnStep === 'powers_after_draw'" class="block">
              <h4>Use power (declared identity)</h4>
              <template v-if="declaredHeroPowers.length > 0">
                <select v-model="selectedPower">
                  <option v-for="power in declaredHeroPowers" :key="power.name" :value="power.name">
                    {{ power.name }} ({{ power.cost }} gems)
                  </option>
                </select>
                <template v-if="selectedPowerDef?.targetType === 'other_player'">
                  <select v-model="powerTargetPlayerId">
                    <option value="">Target player</option>
                    <option v-for="player in otherPlayers" :key="player.id" :value="player.id">
                      {{ player.displayName }}
                    </option>
                  </select>
                </template>
                <template v-if="selectedPower === 'shoot_player'">
                  <select v-model="powerGuessedHeroId">
                    <option value="">Guessed hero</option>
                    <option v-for="hero in heroes" :key="hero.id" :value="hero.id">{{ hero.name }}</option>
                  </select>
                </template>
                <template v-if="selectedPowerDef?.targetType === 'monster'">
                  <select v-model.number="powerMonsterIndex">
                    <option v-for="(_, idx) in activeMonsters" :key="idx" :value="idx">Monster {{ idx }}</option>
                  </select>
                </template>
                <template v-if="['fight_player_with_discarded_card','command_the_dead','execution'].includes(selectedPower)">
                  <select v-model="powerHeroId">
                    <option value="">Hero id</option>
                    <option v-for="hero in heroes" :key="hero.id" :value="hero.id">{{ hero.name }}</option>
                  </select>
                </template>
                <button type="button" @click="usePower">Use power</button>
              </template>
              <button type="button" class="btn-end" @click="endTurn">End turn</button>
            </div>

            <div v-else-if="turnStep === 'attack_after_declare'" class="block">
              <h4>Attack monster</h4>
              <select v-model.number="attackMonsterIndex">
                <option v-for="(_, idx) in activeMonsters" :key="idx" :value="idx">
                  Monster {{ idx }} - {{ monstersById.get(activeMonsters[idx] ?? "")?.name ?? "" }}
                </option>
              </select>
              <button type="button" @click="attackMonster">Attack</button>
              <button type="button" class="btn-end" @click="endTurn">End turn</button>
            </div>

            <div v-else-if="turnStep === 'end_turn'" class="block">
              <h4>Finish turn</h4>
              <button type="button" @click="endTurn">End turn</button>
            </div>
          </template>
        </template>
      </div>
    </div>

    <div class="grid">
      <div class="panel">
        <h3>Room Messages</h3>
        <p v-if="drawResult">
          Draw result hero id: <strong>{{ drawResult.heroId }}</strong>
        </p>
        <p v-if="accuseResult">
          Last accuse result: <strong>{{ accuseResult.success ? "liar caught" : "wrong accusation" }}</strong>
        </p>

        <h4>Recent Events</h4>
        <ul class="event-list">
          <li v-for="(event, idx) in eventLog.slice(0, 20)" :key="idx">
            <code>{{ event.type }}</code>
            <span> - turn {{ eventTurn(event) }}</span>
          </li>
        </ul>
      </div>

      <div class="panel">
        <h3>Rules and Cards</h3>
        <details>
          <summary>Game Rules</summary>
          <pre class="markdown-box">{{ rulesMarkdown }}</pre>
        </details>

        <details>
          <summary>Heroes ({{ heroes.length }})</summary>
          <ul class="compact-list">
            <li v-for="hero in heroes" :key="hero.id">
              {{ hero.name }} ({{ hero.id }}) - STR {{ hero.strength }} - {{ hero.power1 || "-" }} /
              {{ hero.power2 || "-" }}
            </li>
          </ul>
        </details>

        <details>
          <summary>Monsters ({{ monsters.length }})</summary>
          <ul class="compact-list">
            <li v-for="monster in monsters" :key="monster.id">
              {{ monster.name }} ({{ monster.id }}) - STR {{ monster.strength }} - loot C{{ monster.loot_coins }}
              / G{{ monster.loot_gems }}
            </li>
          </ul>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.room-page {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header h2 {
  margin: 0;
}

.status,
.error {
  margin: 0;
}

.error {
  color: #b71c1c;
}

.turn-banner {
  padding: 0.75rem 1rem;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 8px;
  font-size: 1.1rem;
}

.turn-banner--mine {
  background: #c8e6c9;
  border-color: #81c784;
}

.turn-banner-step {
  font-size: 0.85rem;
  color: #666;
  margin-left: 0.5rem;
}

.your-card {
  margin-bottom: 0.5rem;
}

.your-card-name {
  font-size: 1.25rem;
  font-weight: bold;
  margin: 0.25rem 0;
}

.your-card-meta {
  margin: 0;
  font-size: 0.9rem;
  color: #555;
}

.block-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.action-hint {
  margin: 0 0 0.35rem;
  font-size: 0.9rem;
  color: #555;
}

.btn-end {
  margin-top: 0.35rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 1rem;
}

.panel {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: #fff;
}

.panel h3 {
  margin: 0 0 0.75rem;
}

.panel h4 {
  margin: 0.75rem 0 0.5rem;
}

.players-table {
  width: 100%;
  border-collapse: collapse;
}

.players-table th,
.players-table td {
  border: 1px solid #e5e5e5;
  padding: 0.35rem 0.5rem;
  font-size: 0.9rem;
  text-align: left;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.block {
  border: 1px solid #ececec;
  border-radius: 6px;
  padding: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

button,
select {
  border-radius: 4px;
  border: 1px solid #bdbdbd;
  padding: 0.4rem 0.5rem;
  font-size: 0.9rem;
}

button {
  background: #1976d2;
  border-color: #1976d2;
  color: #fff;
  cursor: pointer;
}

.event-list {
  margin: 0;
  padding-left: 1rem;
}

.markdown-box {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.6rem;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
}

.compact-list {
  margin: 0.5rem 0 0;
  padding-left: 1rem;
}
</style>
