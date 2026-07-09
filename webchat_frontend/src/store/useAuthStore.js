import { create } from "zustand";
import useChatStore from "./useChatStore";
import { disconnectWebSocket } from "../utils/websocket";
import pushNotificationService from "../services/pushNotificationService";

const useAuthStore = create((set) => ({
  // holds the authentication state of the user
  user: null,
  isAuthenticated: false,
  isLoading: false,
  // indicates whether we've finished checking for an existing session
  isInitialized: false,

  // functions to update the state
  // called when restoring user from token or updating profile
  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isInitialized: true,
    }),

  // called after successful login to save user data and token
  login: (userData, token) => {
    disconnectWebSocket();
    useChatStore.getState().clearStore();
    localStorage.setItem("token", token);
    set({ user: userData, isAuthenticated: true, isInitialized: true });
  },

  logout: () => {
    disconnectWebSocket();
    useChatStore.getState().clearStore();
    localStorage.removeItem("token");
    set({ user: null, isAuthenticated: false, isInitialized: true });
    void pushNotificationService.teardown().finally(() => {
      if (typeof window === "undefined") return;
      const path = window.location.pathname;
      const onAuthScreen =
        path === "/login" ||
        path === "/register" ||
        path.startsWith("/forgot-password") ||
        path.startsWith("/reset-password");
      if (!onAuthScreen) {
        window.location.assign("/login");
      }
    });
  },

  // updates the loading state
  // used during async operations (waiting for login API response, fetching profile)
  setLoading: (isLoading) => set({ isLoading }),
}));

export default useAuthStore;
