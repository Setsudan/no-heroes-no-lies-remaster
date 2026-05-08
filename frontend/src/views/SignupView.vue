<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();

const username = ref("");
const email = ref("");
const password = ref("");
const localError = ref<string | null>(null);
const isSubmitting = ref(false);

function isValidEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

async function handleSubmit() {
  const trimmedUsername = username.value.trim();
  const trimmedEmail = email.value.trim();

  if (!trimmedUsername || !trimmedEmail || !password.value) {
    localError.value = "Username, email and password are required";
    return;
  }

  if (!isValidEmail(trimmedEmail)) {
    localError.value = "Email format is invalid";
    return;
  }

  isSubmitting.value = true;
  localError.value = null;

  try {
    await auth.register(trimmedUsername, trimmedEmail, password.value);
    router.push("/lobbies");
  } catch (err) {
    const message = (err as Error).message || auth.error.value || "Failed to register";
    localError.value = message;
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth">
    <h2>Sign up</h2>
    <form class="form" @submit.prevent="handleSubmit">
      <div class="field">
        <label for="username">Username</label>
        <input id="username" v-model="username" type="text" autocomplete="username" />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" autocomplete="email" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="new-password" />
      </div>

      <p v-if="localError" class="error">
        {{ localError }}
      </p>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? "Creating account..." : "Create account" }}
      </button>
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
</style>

