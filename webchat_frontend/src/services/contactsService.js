import api from "./api";

const contactsService = {
  getStatus: async (otherUserId, currentUserId) => {
    const response = await api.get(`/api/users/contacts/status/${otherUserId}`, {
      headers: currentUserId ? { "X-User-Id": currentUserId } : undefined,
    });
    return response.data;
  },

  acceptRequest: async (requestId, currentUserId) => {
    const response = await api.post(
      `/api/users/contacts/requests/${requestId}/accept`,
      {},
      { headers: currentUserId ? { "X-User-Id": currentUserId } : undefined }
    );
    return response.data;
  },

  declineRequest: async (requestId, currentUserId) => {
    const response = await api.post(
      `/api/users/contacts/requests/${requestId}/decline`,
      {},
      { headers: currentUserId ? { "X-User-Id": currentUserId } : undefined }
    );
    return response.data;
  },
};

export default contactsService;
