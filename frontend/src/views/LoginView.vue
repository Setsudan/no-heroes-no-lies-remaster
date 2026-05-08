<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const localError = ref<string | null>(null);
const isSubmitting = ref(false);

async function handleSubmit() {
  if (!email.value.trim() || !password.value.trim()) {
    localError.value = "Email and password are required";
    return;
  }

  isSubmitting.value = true;
  localError.value = null;

  try {
    await auth.login(email.value.trim(), password.value);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/lobbies";
    router.push(redirect);
  } catch (err) {
    const message = (err as Error).message || auth.error.value || "Failed to login";
    localError.value = message;
  } finally {
    isSubmitting.value = false;
  }
}

function goToGuest() {
  router.push({ path: "/", query: route.query });
}
</script>

<template>
  <section class="auth">
    <h2>Login</h2>
    <form class="form" @submit.prevent="handleSubmit">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" autocomplete="email" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" />
      </div>

      <p v-if="localError" class="error">
        {{ localError }}
      </p>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? "Signing in..." : "Login" }}
      </button>
      <p class="guest-link">
        <button type="button" class="link" @click="goToGuest">
          Enter as guest
        </button>
      </p>
    </form>
  </section>
</template>

<style scoped>
.auth {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

h2 {
  margin: 0 0 1rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

label {
  font-size: 0.9rem;
  color: #444;
}

input {
  padding: 0.45rem 0.55rem;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 0.95rem;
}

button {
  margin-top: 0.75rem;
  border-radius: 4px;
  border: 1px solid #1976d2;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  cursor: pointer;
  background-color: #1976d2;
  color: #fff;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error {
  margin: 0.25rem 0 0;
  color: #b71c1c;
  font-size: 0.9rem;
}

.guest-link {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
}

button.link {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: #1976d2;
  cursor: pointer;
  text-decoration: underline;
}
</style>

