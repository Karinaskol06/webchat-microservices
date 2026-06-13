import api from './api';

const userBanService = {
  banUser: async (targetUserId, currentUserId) => {
    await api.post(`/api/users/bans/${targetUserId}`, null, {
      headers: currentUserId ? { 'X-User-Id': currentUserId } : undefined,
    });
  },

  unbanUser: async (targetUserId, currentUserId) => {
    await api.delete(`/api/users/bans/${targetUserId}`, {
      headers: currentUserId ? { 'X-User-Id': currentUserId } : undefined,
    });
  },

  listBannedUsers: async (currentUserId) => {
    const response = await api.get('/api/users/bans', {
      headers: currentUserId ? { 'X-User-Id': currentUserId } : undefined,
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  getBanStatus: async (targetUserId, currentUserId) => {
    const response = await api.get(`/api/users/bans/status/${targetUserId}`, {
      headers: currentUserId ? { 'X-User-Id': currentUserId } : undefined,
    });
    return Boolean(response.data?.banned);
  },
};

export default userBanService;
