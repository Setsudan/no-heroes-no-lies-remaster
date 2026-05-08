import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import HomeView from "./views/HomeView.vue";
import LoginView from "./views/LoginView.vue";
import SignupView from "./views/SignupView.vue";
import LobbiesView from "./views/LobbiesView.vue";
import GameRoomView from "./views/GameRoomView.vue";
import { useAuthStore } from "./stores/auth";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: HomeView
  },
  {
    path: "/login",
    name: "login",
    component: LoginView
  },
  {
    path: "/signup",
    name: "signup",
    component: SignupView
  },
  {
    path: "/game",
    redirect: "/lobbies"
  },
  {
    path: "/lobbies",
    name: "lobbies",
    component: LobbiesView,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: "/game/:sessionId",
    name: "game-room",
    component: GameRoomView,
    meta: {
      requiresAuth: true
    }
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.authProbeDone.value) {
    await auth.fetchMe();
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated.value) {
    return {
      path: "/",
      query: {
        redirect: to.fullPath
      }
    };
  }

  if ((to.path === "/login" || to.path === "/signup") && auth.isAuthenticated.value) {
    return { path: "/lobbies" };
  }

  return true;
});

export default router;

