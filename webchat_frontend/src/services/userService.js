import api from "./api";

const userService = {
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
};

export default userService;
