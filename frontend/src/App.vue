<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();

const isAuthenticated = computed(() => auth.isAuthenticated.value);
const username = computed(() => auth.currentUser.value?.username ?? "");
const userEmail = computed(() => auth.currentUser.value?.email ?? "");

onMounted(() => {
  if (!auth.authProbeDone.value) {
    auth.fetchMe();
  }
});

function handleLogout() {
  auth.logout().catch(() => {
    // ignore logout errors in UI
  });
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <RouterLink to="/" class="brand-link">
          <span class="brand-title">No Heroes No Lies</span>
        </RouterLink>
      </div>
      <nav class="nav">
        <RouterLink to="/" class="nav-link">Home</RouterLink>
        <RouterLink v-if="isAuthenticated" to="/lobbies" class="nav-link">Lobbies</RouterLink>
      </nav>
      <div class="auth-status">
        <template v-if="isAuthenticated">
          <span class="user-label">
            {{ username }} ({{ userEmail }})
          </span>
          <button type="button" class="link-button" @click="handleLogout">
            Logout
          </button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="nav-link">Login</RouterLink>
          <RouterLink to="/signup" class="nav-link">Sign up</RouterLink>
        </template>
      </div>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  background-color: #ffffff;
}

.brand-link {
  text-decoration: none;
  color: inherit;
}

.brand-title {
  font-weight: 600;
}

.nav {
  display: flex;
  gap: 0.75rem;
}

.nav-link {
  text-decoration: none;
  color: #1976d2;
  font-size: 0.95rem;
}

.nav-link.router-link-active {
  font-weight: 600;
}

.auth-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.user-label {
  color: #444;
}

.link-button {
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  color: #1976d2;
  cursor: pointer;
  font-size: 0.9rem;
}

.app-main {
  flex: 1;
  padding: 1rem 1.25rem 1.5rem;
}
</style>
