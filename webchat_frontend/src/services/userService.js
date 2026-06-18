import api from "./api";

const userService = {
  getCurrentProfile: async () => {
    const response = await api.get("/api/users/profile");
    return response.data;
  },

  /** Full public profile (avatar/background URLs, description, birthday, …) — use when viewing any user by id */
  getUserById: async (userId) => {
    const response = await api.get(`/api/users/${userId}`);
    return response.data;
  },

  searchUsers: async (query, page = 0, size = 20, currentUserId) => {
    const response = await api.get("/api/users/search", {
      params: { query, page, size },
      headers: currentUserId ? { "X-User-Id": currentUserId } : undefined,
    });

    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    return data?.content || [];
  },

  updateProfile: async (payload) => {
    const response = await api.put("/api/users/profile", payload);
    return response.data;
  },

  checkUsernameAvailability: async (value) => {
    const response = await api.get("/api/users/profile/availability/username", {
      params: { value },
    });
    return response.data;
  },

  checkEmailAvailability: async (value) => {
    const response = await api.get("/api/users/profile/availability/email", {
      params: { value },
    });
    return response.data;
  },

  updateAccount: async (payload) => {
    const response = await api.put("/api/users/account", payload);
    return response.data;
  },

  changePassword: async ({ oldPassword, newPassword, repeatPassword }) => {
    const response = await api.put("/api/users/change-password", {
      oldPassword,
      newPassword,
      repeatPassword,
    });
    return response.data;
  },

  deleteAccount: async ({ password, confirmUsername }) => {
    const response = await api.delete("/api/users/account", {
      data: { password, confirmUsername },
    });
    return response.data;
  },

  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/api/users/profile/avatar", formData);
    return response.data;
  },

  removeAvatar: async () => {
    const response = await api.delete("/api/users/profile/avatar");
    return response.data;
  },

  uploadBackground: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/api/users/profile/background", formData);
    return response.data;
  },

  removeBackground: async () => {
    const response = await api.delete("/api/users/profile/background");
    return response.data;
  },
};

export default userService;
