<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const isAuthenticated = computed(() => auth.isAuthenticated.value);
const displayName = computed(
  () => auth.currentUser.value?.email ?? auth.currentUser.value?.username ?? ""
);

const guestUsername = ref("");
const guestError = ref<string | null>(null);
const isGuestSubmitting = ref(false);

function goToLogin() {
  router.push({ name: "login" });
}

function goToSignup() {
  router.push({ name: "signup" });
}

function goToGame() {
  router.push({ name: "lobbies" });
}

async function handleGuestSubmit() {
  const name = guestUsername.value.trim();
  if (name.length < 3 || name.length > 50) {
    guestError.value = "Username must be between 3 and 50 characters";
    return;
  }

  isGuestSubmitting.value = true;
  guestError.value = null;
  try {
    await auth.guestLogin(name);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/lobbies";
    router.push(redirect);
  } catch (err) {
    guestError.value = (err as Error).message || auth.error.value || "Failed to enter as guest";
  } finally {
    isGuestSubmitting.value = false;
  }
}
</script>

<template>
  <section class="home">
    <h2>No Heroes No Lies</h2>
    <p class="tagline">Online bluffing card game with live rooms and full turn actions.</p>

    <div v-if="isAuthenticated" class="card">
      <p class="text">
        Signed in as
        <strong>{{ displayName }}</strong>
      </p>
      <button type="button" class="primary" @click="goToGame">
        Open lobbies
      </button>
    </div>

    <div v-else class="card">
      <p class="text">Create an account or sign in to start playing.</p>
      <div class="actions">
        <button type="button" class="primary" @click="goToSignup">
          Sign up
        </button>
        <button type="button" class="secondary" @click="goToLogin">
          Login
        </button>
      </div>
      <div class="guest-section">
        <p class="guest-hint">Or enter as guest (username only, temporary session):</p>
        <form class="guest-form" @submit.prevent="handleGuestSubmit">
          <input
            v-model="guestUsername"
            type="text"
            placeholder="Username (3–50 chars)"
            minlength="3"
            maxlength="50"
            :disabled="isGuestSubmitting"
          />
          <button type="submit" class="secondary" :disabled="isGuestSubmitting">
            {{ isGuestSubmitting ? "Entering..." : "Enter as guest" }}
          </button>
        </form>
        <p v-if="guestError" class="error">{{ guestError }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

h2 {
  margin: 0;
}

.tagline {
  margin-top: 0.5rem;
  color: #555;
}

.card {
  margin-top: 1.5rem;
  padding: 1.25rem 1.5rem;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  background-color: #fafafa;
}

.text {
  margin-bottom: 1rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.guest-section {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.guest-hint {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #555;
}

.guest-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.guest-form input {
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 0.95rem;
}

.error {
  margin: 0.25rem 0 0;
  color: #b71c1c;
  font-size: 0.9rem;
}

button {
  border-radius: 4px;
  border: 1px solid #ccc;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  cursor: pointer;
  background-color: #f4f4f4;
}

button.primary {
  background-color: #1976d2;
  border-color: #1976d2;
  color: #fff;
}

button.secondary {
  background-color: #ffffff;
}
</style>

