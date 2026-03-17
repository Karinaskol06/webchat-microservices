import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  normalizeMessage: (m) => {
    if (!m || typeof m !== 'object') return m;
    if (typeof m.isRead === 'boolean') return m;
    if (typeof m.read === 'boolean') return { ...m, isRead: m.read };
    return m;
  },
  // a list of user's chats
  chats: [],
  
  // currently selected chat
  currentChat: null,
  
  // messages in the current chat
  messages: [],
  
  // users currently online (for presence indication)
  onlineUsers: new Set(),
  
  // users currently typing (for typing indicators)
  typingUsers: {},

  // loading states
  isLoadingChats: false,
  isLoadingMessages: false,
  error: null,
  
  // actions to update the state
  setChats: (chats) => {
    // Ensure chats is always an array
    const chatsArray = Array.isArray(chats) ? chats : [];
    set({ chats: chatsArray, error: null });
  },
  
  setCurrentChat: (chat) => {
    // just update current chat and clear messages;
    // the page component is responsible for fetching history
    set((state) => {
      // If same chat is clicked, don't trigger re-render
      if (state.currentChat?.id === chat?.id) {
        return state;
      }
      // New chat selected - clear messages
      return { 
        currentChat: chat, 
        messages: [],
        error: null 
      };
    });
  },
  
  setMessages: (messages) => {
    const messagesArray = Array.isArray(messages) ? messages : [];
    const normalize = get().normalizeMessage;
    set({ messages: messagesArray.map(normalize) });
  },
  
  addMessage: (message) => {
    if (!message?.id) return; 
    
    set((state) => {
      const normalize = get().normalizeMessage;
      const normalizedMessage = normalize(message);
      // Check if message already exists (prevents duplicates)
      const messageExists = state.messages.some((m) => m.id === message.id);
      if (messageExists) return state;
      
      // Add new message and sort by timestamp if needed
      const newMessages = [...state.messages, normalizedMessage];
      // Optional: sort by timestamp
      newMessages.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      return { messages: newMessages };
    });
  },

  // update read status for one or many messages
  markMessagesRead: (messageIds) => {
    const ids = Array.isArray(messageIds) ? messageIds : [messageIds];
    if (ids.length === 0) return;
    const idSet = new Set(ids.filter(Boolean));
    if (idSet.size === 0) return;
    set((state) => ({
      messages: state.messages.map((m) =>
        idSet.has(m.id)
          ? { ...m, isRead: true, read: true, readAt: m.readAt || new Date().toISOString() }
          : m
      ),
    }));
  },
  
  // Always cretae a new set for reactiviy when updating online users
  setOnlineUsers: (users) => {
    const usersArray = Array.isArray(users) ? users : [];
    set({ onlineUsers: new Set(usersArray) });
  },
  
  setTyping: (userId, isTyping) => {
    set((state) => ({
      typingUsers: { 
        ...state.typingUsers, 
        [userId]: isTyping 
      }
    }));
  },

  setLoadingChats: (isLoading) => set({ isLoadingChats: isLoading }),
  setLoadingMessages: (isLoading) => set({ isLoadingMessages: isLoading }),

  setError: (error) => set({ error }),

    // Clear all state (useful for logout)
  clearStore: () => set({
    chats: [],
    currentChat: null,
    messages: [],
    onlineUsers: new Set(),
    typingUsers: {},
    isLoadingChats: false,
    isLoadingMessages: false,
    error: null
  }),

  getOtherParticipant: (chatId) => {
    const state = get();
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat?.participants) return null;
    // Find participant that's not current user
    return chat.participants[0];
  },

  // Get unread count for a chat
  getUnreadCount: (chatId) => {
    const state = get();
    const chat = state.chats.find(c => c.id === chatId);
    return chat?.unreadCount || 0;
  }
}));

export default useChatStore;