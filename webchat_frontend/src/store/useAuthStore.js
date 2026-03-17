import { create } from "zustand";

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
    // save token to local storage for persistence across sessions
    localStorage.setItem("token", token);
    // update the store with user data and set authenticated to true
    set({ user: userData, isAuthenticated: true, isInitialized: true });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, isAuthenticated: false, isInitialized: true });
  },

  // updates the loading state
  // used during async operations (waiting for login API response, fetching profile)
  setLoading: (isLoading) => set({ isLoading }),
}));

export default useAuthStore;
