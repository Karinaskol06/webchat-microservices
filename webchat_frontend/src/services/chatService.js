import api, { getApiErrorMessage } from "./api";

const chatService = {
  // create a new chat with the specified user
  createPrivateChat: async (createChatData) => {
    try {
      const response = await api.post(`/api/chat/create`, createChatData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  searchUsers: async (query, { page = 0, size = 20, currentUserId } = {}) => {
    try {
      const response = await api.get('/api/users/search', {
        params: {
          query: query?.trim(),
          page,
          size
        },
        headers: currentUserId ? { 'X-User-Id': currentUserId } : undefined
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  discoverRooms: async (q = '', page = 0, size = 20) => {
    try {
      const response = await api.get('/api/chat/discover', {
        params: { q: q?.trim() ?? '', page, size },
      });
      const data = response.data;
      return {
        rooms: Array.isArray(data?.content) ? data.content : [],
        totalPages: data?.totalPages ?? 0,
        page: data?.number ?? page,
        last: data?.last ?? true,
      };
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  joinPublicRoom: async (roomId) => {
    try {
      const response = await api.post(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/join`
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  joinByInvite: async (token) => {
    try {
      const response = await api.post('/api/chat/join-invite', { token });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  mutateRoomAdmins: async (roomId, userId, action) => {
    try {
      const response = await api.post(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/admins`,
        { userId, action },
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  addRoomMember: async (roomId, userId) => {
    try {
      const response = await api.post(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/members`,
        { userId },
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  updateRoomPhoto: async (roomId, groupPhoto) => {
    try {
      const response = await api.patch(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/photo`,
        { groupPhoto },
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  inviteRoomMemberByUsername: async (roomId, username) => {
    try {
      const response = await api.post(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/member-invites`,
        { username: String(username || '').trim().replace(/^@/, '') },
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  listPendingRoomMemberInvites: async () => {
    try {
      const response = await api.get('/api/chat/member-invites/pending');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  acceptRoomMemberInvite: async (inviteId) => {
    try {
      const response = await api.post(
        `/api/chat/member-invites/${encodeURIComponent(inviteId)}/accept`,
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  declineRoomMemberInvite: async (inviteId) => {
    try {
      await api.post(
        `/api/chat/member-invites/${encodeURIComponent(inviteId)}/decline`,
      );
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  createGroupRoom: async ({ name, visibility, description, groupPhoto, memberIds }) => {
    try {
      const response = await api.post('/api/chat/rooms/group', {
        name,
        visibility,
        description: description || undefined,
        groupPhoto: groupPhoto || undefined,
        memberIds: memberIds ?? [],
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  createChannelRoom: async ({ name, visibility, description, groupPhoto, memberIds }) => {
    try {
      const response = await api.post('/api/chat/rooms/channel', {
        name,
        visibility,
        description: description || undefined,
        groupPhoto: groupPhoto || undefined,
        memberIds: memberIds ?? [],
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  searchMyGroupChannels: async (q = '', page = 0, size = 20) => {
    try {
      const response = await api.get('/api/chat/my-rooms', {
        params: { q: q?.trim() ?? '', page, size },
      });
      const data = response.data;
      return {
        rooms: Array.isArray(data?.content) ? data.content : [],
        totalPages: data?.totalPages ?? 0,
        page: data?.number ?? page,
        last: data?.last ?? true,
      };
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getRoom: async (roomId) => {
    try {
      const response = await api.get(
        `/api/chat/rooms/${encodeURIComponent(roomId)}`,
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getRoomInvite: async (roomId) => {
    try {
      const response = await api.get(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/invite`,
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  regenerateRoomInvite: async (roomId) => {
    try {
      const response = await api.post(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/invite/regenerate`,
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  //fetch all chats for the current user
  getUserChats: async (page = 0, size = 20) => {
    try {
      const response = await api.get("/api/chat", {
        params: { page, size },
      });
      // Handle different response formats and ensure array return
      const data = response.data;
      
      if (Array.isArray(data)) {
        return data;
      } else if (data?.content && Array.isArray(data.content)) {
        return data.content; // Handle paginated response
      } else {
        return []; // Return empty array as fallback
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      return []; // Return empty array on error
    }
  },

  uploadAttachments: async (chatId, files) => {
    const formData = new FormData();

    // Важливо: додаємо кожен файл окремо
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      // Перевіряємо чи є токен
      const token = localStorage.getItem('token');
      console.log('📤 Uploading to:', `/api/chat/${chatId}/attachments`);
      console.log('🔑 Token exists:', !!token);

      const response = await api.post(`/api/chat/${chatId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          // Переконайтесь, що Authorization додається
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('❌ Upload error details:', {
        status: error.response?.status,
        message: error.response?.data,
        headers: error.response?.headers
      });
      throw error;
    }
  },

  getChatAttachments: async (chatId) => {
    try {
      const response = await api.get(
        `/api/chat/${encodeURIComponent(chatId)}/attachments`,
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      throw getApiErrorMessage(error, 'Failed to load attachments');
    }
  },

  getAttachmentBlob: async (attachmentId, { download = false } = {}) => {
    const response = await api.get(`/api/chat/attachments/${attachmentId}`, {
      responseType: 'blob',
      params: download ? { download: true } : undefined
    });
    return response.data;
  },

  // get message history for a specific chat
  getMessages: async (chatId, page = 0, size = 50) => {
    try {
      const response = await api.get(`/api/chat/${chatId}/messages`, {
        params: { page, size }
      });
      // Handle paginated response
      return {
        messages: response.data.content || [],
        totalPages: response.data.totalPages,
        currentPage: response.data.number,
        hasMore: !response.data.last
      };
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // mark messages as read in a specific chat
  markAsRead: async (chatId) => {
    try {
      await api.post(`/api/chat/${chatId}/read`);
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // get unread message count for a specific chat
  getUnreadCount: async (chatId) => {
    try {
      const response = await api.get(`/api/chat/${chatId}/unread-count`);
      return response.data.unreadCount;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // delete a message
  deleteMessage: async (messageId) => {
    try {
      await api.delete(`/api/chat/messages/${messageId}`);
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  editMessage: async (messageId, content) => {
    try {
      const response = await api.put(`/api/chat/messages/${messageId}`, { content });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  toggleMessageReaction: async (chatId, messageId, emoji) => {
    try {
      const cid = chatId != null ? String(chatId).trim() : '';
      const mid = messageId != null ? String(messageId).trim() : '';
      if (!cid || !mid) {
        throw new Error('Chat and message id are required');
      }
      const response = await api.post(
        `/api/chat/${encodeURIComponent(cid)}/messages/${encodeURIComponent(mid)}/reactions`,
        { emoji },
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // leave a chat
  leaveChat: async (chatId) => {
    try {
      await api.post(`/api/chat/${chatId}/leave`);
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  enterChat: async (chatId) => {
    try {
      await api.post(`/api/presence/enter-chat/${chatId}`);
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  heartbeatChat: async (chatId) => {
    try {
      await api.post(`/api/presence/heartbeat/${chatId}`);
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  markAfk: async (chatId) => {
    try {
      await api.post(`/api/presence/afk/${chatId}`);
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // send typing indicator in a specific chat
  sendTyping: async (chatId, isTyping) => {
    try {
      await api.post(`/api/chat/${chatId}/typing`, { typing: isTyping });
    } catch (error) {
      // Silently fail for typing indicators
      console.debug('Typing indicator failed:', error);
    }
  },

  // get presence status for a user in a chat
  getPresenceStatus: async (userId, chatId) => {
    try {
      const response = await api.get(`/api/presence/status/${userId}/${chatId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching presence status:', error);
      return null;
    }
  },
};

export default chatService;
