<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { createLobby, joinLobby, listLobbies, type Lobby } from "../api/lobbies";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();

const isLoading = ref(false);
const isCreating = ref(false);
const joiningLobbyId = ref<string | null>(null);
const error = ref<string | null>(null);
const lobbies = ref<Lobby[]>([]);

const displayName = ref(auth.currentUser.value?.username ?? "Player");
const maxPlayers = ref(4);
const botCount = ref(0);
const burnedHeroesCount = ref(1);

const canCreate = computed(
  () =>
    !isCreating.value &&
    maxPlayers.value >= 2 &&
    maxPlayers.value <= 10 &&
    botCount.value >= 0 &&
    botCount.value < maxPlayers.value &&
    burnedHeroesCount.value >= 1
);

const isGuest = computed(
  () => auth.currentUser.value != null && auth.currentUser.value.email == null
);

async function refreshLobbies(): Promise<void> {
  isLoading.value = true;
  error.value = null;
  try {
    const response = await listLobbies();
    lobbies.value = response.lobbies;
  } catch (err) {
    error.value = (err as Error).message || "Failed to load lobbies";
  } finally {
    isLoading.value = false;
  }
}

async function joinAndEnterGame(lobby: Lobby): Promise<void> {
  const name = displayName.value.trim() || auth.currentUser.value?.username || "Player";
  joiningLobbyId.value = lobby.id;
  error.value = null;
  try {
    const response = await joinLobby(lobby.id, { displayName: name });
    await router.push({
      name: "game-room",
      params: { sessionId: response.room.sessionId },
      query: {
        displayName: name
      }
    });
  } catch (err) {
    error.value = (err as Error).message || "Failed to join lobby";
  } finally {
    joiningLobbyId.value = null;
  }
}

async function handleCreateLobby(): Promise<void> {
  if (!canCreate.value) {
    error.value = "Invalid lobby settings";
    return;
  }

  isCreating.value = true;
  error.value = null;

  try {
    const created = await createLobby({
      maxPlayers: maxPlayers.value,
      botCount: botCount.value,
      burnedHeroesCount: burnedHeroesCount.value
    });
    await joinAndEnterGame(created.lobby);
  } catch (err) {
    error.value = (err as Error).message || "Failed to create lobby";
  } finally {
    isCreating.value = false;
  }
}

onMounted(() => {
  refreshLobbies();
});
</script>

<template>
  <section class="lobbies-page">
    <header class="page-header">
      <h2>Lobbies</h2>
      <button type="button" :disabled="isLoading" @click="refreshLobbies">
        {{ isLoading ? "Refreshing..." : "Refresh" }}
      </button>
    </header>

    <p v-if="isGuest" class="guest-notice">
      Playing as guest. Sign up to save your progress.
    </p>

    <p class="subtitle">Create a room or join an open match.</p>

    <div class="panel create-panel">
      <h3>Create Lobby</h3>
      <div class="fields">
        <label>
          Display name
          <input v-model="displayName" type="text" maxlength="50" />
        </label>
        <label>
          Max players
          <input v-model.number="maxPlayers" type="number" min="2" max="10" />
        </label>
        <label>
          Bot count
          <input v-model.number="botCount" type="number" min="0" :max="Math.max(0, maxPlayers - 1)" />
        </label>
        <label>
          Burned heroes
          <input v-model.number="burnedHeroesCount" type="number" min="1" />
        </label>
      </div>
      <button type="button" :disabled="!canCreate" @click="handleCreateLobby">
        {{ isCreating ? "Creating..." : "Create and Join" }}
      </button>
    </div>

    <div class="panel">
      <h3>Open Lobbies</h3>
      <p v-if="lobbies.length === 0 && !isLoading" class="muted">No open lobbies yet.</p>

      <table v-else class="lobbies-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Players</th>
            <th>Bots</th>
            <th>Burned</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lobby in lobbies" :key="lobby.id">
            <td>{{ lobby.lobby_code || "-" }}</td>
            <td>{{ lobby.player_count }}</td>
            <td>{{ lobby.bot_count }}</td>
            <td>{{ lobby.burned_heroes_count }}</td>
            <td>{{ new Date(lobby.created_at).toLocaleString() }}</td>
            <td>
              <button
                type="button"
                :disabled="joiningLobbyId === lobby.id"
                @click="joinAndEnterGame(lobby)"
              >
                {{ joiningLobbyId === lobby.id ? "Joining..." : "Join" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </section>
</template>

<style scoped>
.lobbies-page {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  margin: 0;
}

.subtitle {
  margin: 0;
  color: #555;
}

.guest-notice {
  margin: 0;
  padding: 0.5rem 0.75rem;
  background-color: #fff8e1;
  border: 1px solid #ffc107;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #5d4e37;
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

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}

input {
  padding: 0.45rem 0.55rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.95rem;
}

button {
  border: 1px solid #1976d2;
  background: #1976d2;
  color: #fff;
  padding: 0.45rem 0.85rem;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.lobbies-table {
  width: 100%;
  border-collapse: collapse;
}

.lobbies-table th,
.lobbies-table td {
  border: 1px solid #e5e5e5;
  padding: 0.45rem 0.55rem;
  text-align: left;
  font-size: 0.9rem;
}

.muted {
  margin: 0;
  color: #666;
}

.error {
  margin: 0;
  color: #b71c1c;
}
</style>
