import api from './api';

const userBanService = {
  banUser: async (targetUserId) => {
    await api.post(`/api/users/bans/${targetUserId}`);
  },

  unbanUser: async (targetUserId) => {
    await api.delete(`/api/users/bans/${targetUserId}`);
  },

  listBannedUsers: async () => {
    const response = await api.get('/api/users/bans');
    return Array.isArray(response.data) ? response.data : [];
  },

  getBanStatus: async (targetUserId) => {
    const response = await api.get(`/api/users/bans/status/${targetUserId}`);
    return Boolean(response.data?.banned);
  },
};

export default userBanService;
