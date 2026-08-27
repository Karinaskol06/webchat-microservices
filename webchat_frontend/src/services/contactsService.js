import api from "./api";

const contactsService = {
  listContacts: async () => {
    const response = await api.get("/api/users/contacts");
    return Array.isArray(response.data) ? response.data : [];
  },

  listIncomingRequests: async () => {
    const response = await api.get("/api/users/contacts/requests/incoming");
    return Array.isArray(response.data) ? response.data : [];
  },

  getStatus: async (otherUserId) => {
    const response = await api.get(`/api/users/contacts/status/${otherUserId}`);
    return response.data;
  },

  /** One-sided add from profile (no request required). */
  addContact: async (contactUserId) => {
    const response = await api.post(`/api/users/contacts/${contactUserId}`, {});
    return response.data;
  },

  acceptRequest: async (requestId) => {
    const response = await api.post(
      `/api/users/contacts/requests/${requestId}/accept`,
      {}
    );
    return response.data;
  },

  /** Sender adds recipient to their own contact list (one-sided) while request is pending. */
  addSenderContact: async (requestId) => {
    const response = await api.post(
      `/api/users/contacts/requests/${requestId}/add-sender`,
      {}
    );
    return response.data;
  },

  declineRequest: async (requestId) => {
    const response = await api.post(
      `/api/users/contacts/requests/${requestId}/decline`,
      {}
    );
    return response.data;
  },

  removeContact: async (contactUserId) => {
    await api.delete(`/api/users/contacts/${contactUserId}`);
  },
};

export default contactsService;
