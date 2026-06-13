import api, { getApiErrorMessage } from "./api";

const chatService = {
  getPersonalSpace: async () => {
    const response = await api.get('/api/chat/personal-space');
    return response.data;
  },

  listPersonalSpaces: async () => {
    const response = await api.get('/api/chat/personal-spaces');
    return response.data;
  },

  createPersonalSpace: async ({ name, description, groupPhoto } = {}) => {
    const response = await api.post('/api/chat/personal-spaces', {
      name,
      ...(description ? { description } : {}),
      ...(groupPhoto ? { groupPhoto } : {}),
    });
    return response.data;
  },

  sendRichMessage: async (chatId, type, content, replyToMessageId = null) => {
    try {
      const response = await api.post(
        `/api/chat/${encodeURIComponent(chatId)}/rich-messages`,
        {
          type,
          content,
          ...(replyToMessageId ? { replyToMessageId } : {}),
        },
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

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

  banRoomMember: async (roomId, userId) => {
    try {
      const response = await api.post(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}/ban`,
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  unbanRoomMember: async (roomId, userId) => {
    try {
      const response = await api.delete(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/bans/${encodeURIComponent(userId)}`,
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  listBannedRoomMembers: async (roomId) => {
    try {
      const response = await api.get(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/bans`,
      );
      return Array.isArray(response.data) ? response.data : [];
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

  updateRoomProfile: async (roomId, { groupName, description, groupPhoto } = {}) => {
    try {
      const body = {};
      if (groupName !== undefined) body.groupName = groupName;
      if (description !== undefined) body.description = description;
      if (groupPhoto !== undefined) body.groupPhoto = groupPhoto;
      const response = await api.patch(
        `/api/chat/rooms/${encodeURIComponent(roomId)}`,
        body,
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
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
    const list = Array.isArray(files) ? files : [];
    if (list.length === 0) {
      return [];
    }

    const uploaded = [];
    for (const file of list) {
      const formData = new FormData();
      formData.append('files', file);
      const response = await api.post(
        `/api/chat/${encodeURIComponent(chatId)}/attachments`,
        formData,
      );
      const batch = Array.isArray(response.data) ? response.data : [];
      uploaded.push(...batch);
    }
    return uploaded;
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

  castPollVote: async (messageId, optionIds) => {
    try {
      const response = await api.post(`/api/chat/messages/${messageId}/poll-vote`, {
        optionIds: Array.isArray(optionIds) ? optionIds : [],
      });
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

  deleteRoom: async (roomId) => {
    try {
      await api.delete(`/api/chat/rooms/${encodeURIComponent(roomId)}`);
    } catch (error) {
      const data = error.response?.data;
      const message =
        typeof data === 'string'
          ? data
          : data?.message || error.message || 'Failed to delete room';
      throw new Error(message);
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
