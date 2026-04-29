import api from "./api";

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

  // send a message in a specific chat
  sendMessage: async (chatId, messageData) => {
    try {
      const response = await api.post(
        `/api/chat/${chatId}/messages`,
        { 
          chatId: chatId,          
          content: messageData.content 
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw error.response?.data || error.message;
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

  // leave a chat
  leaveChat: async (chatId) => {
    try {
      await api.post(`/api/chat/${chatId}/leave`);
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
