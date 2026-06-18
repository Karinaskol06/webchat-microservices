import { create } from 'zustand';
import {
  recordSharedMediaAttachmentDeleted,
  recordSharedMediaMessageDeleted,
} from '../utils/sharedMedia';
import { appendCacheBust, bustRoomPhotoUrl, stripMediaCacheKey } from '../utils/userAvatar';
import { getMessagePreviewText } from '../utils/personalSpace';

const messageIdKey = (message) => String(message?.id ?? message?._id ?? '');

const chatLastPreviewTimeMs = (chat) => {
  const raw = chat?.lastMessageTime ?? chat?.lastActivity ?? null;
  if (raw == null || raw === '') return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
};

const buildLastMessagePreviewPatch = (message) => {
  if (!message) {
    return {
      lastMessage: '',
      lastMessageContent: '',
      lastMessageTime: null,
      lastMessageSenderId: null,
      lastMessageType: null,
    };
  }
  const preview = getMessagePreviewText(message) || 'Attachment';
  const senderId = message.senderId ?? message.sender?.id ?? null;
  return {
    lastMessage: preview,
    lastMessageContent: preview,
    lastMessageTime: message.timestamp ?? null,
    lastMessageSenderId: senderId,
    ...(message.messageType != null && message.messageType !== ''
      ? { lastMessageType: String(message.messageType).toUpperCase() }
      : {}),
  };
};

const applyChatLastMessagePatch = (state, chatId, patch) => {
  const key = String(chatId);
  let found = false;
  const nextChats = state.chats.map((chat) => {
    if (String(chat.id) !== key) return chat;
    found = true;
    return { ...chat, ...patch };
  });

  const chats = found
    ? reorderChatsByRecent(nextChats)
    : state.currentChat && String(state.currentChat.id) === key
      ? reorderChatsByRecent([{ ...state.currentChat, ...patch }, ...state.chats])
      : state.chats;

  const next = { chats };
  if (state.currentChat && String(state.currentChat.id) === key) {
    next.currentChat = { ...state.currentChat, ...patch };
  }
  return next;
};

function mergeChatRecord(existing, incoming) {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const merged = { ...existing, ...incoming };
  const nextPhoto = incoming.groupPhoto;
  const prevPhoto = existing.groupPhoto;

  if (nextPhoto !== undefined && nextPhoto !== null) {
    const nextBase = stripMediaCacheKey(nextPhoto);
    const prevBase = stripMediaCacheKey(prevPhoto);
    if (nextBase !== prevBase) {
      const revision = incoming.groupPhotoRevision ?? Date.now();
      merged.groupPhotoRevision = revision;
      merged.groupPhoto = bustRoomPhotoUrl(nextPhoto, revision);
    } else if (existing.groupPhotoRevision != null) {
      merged.groupPhotoRevision = existing.groupPhotoRevision;
      merged.groupPhoto = existing.groupPhoto;
    }
  } else if (existing.groupPhotoRevision != null) {
    merged.groupPhotoRevision = existing.groupPhotoRevision;
  }

  return merged;
}

/** Sort key for sidebar: latest activity or last preview line time */
const chatRecencyMs = (chat) => {
  const raw = chat?.lastMessageTime ?? chat?.lastActivity ?? null;
  if (raw == null || raw === '') return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
};

export const reorderChatsByRecent = (chats) => {
  const arr = Array.isArray(chats) ? [...chats] : [];
  arr.sort((a, b) => chatRecencyMs(b) - chatRecencyMs(a));
  return arr;
};

const useChatStore = create((set, get) => ({
  normalizeMessage: (m) => {
    if (!m || typeof m !== 'object') return m;
    const next = { ...m };
    if (typeof m.read === 'boolean' && typeof m.isRead !== 'boolean') {
      next.isRead = m.read;
    }
    if (m.message_type && !m.messageType) {
      next.messageType = m.message_type;
    }
    const replyId =
      m.replyToMessageId ?? m.reply_to_message_id ?? m.replyToMessageID;
    if (replyId != null && replyId !== '' && !next.replyToMessageId) {
      next.replyToMessageId = replyId;
    }
    if (m.replied_message != null && next.repliedMessage == null) {
      next.repliedMessage = m.replied_message;
    }
    return next;
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
    set({ chats: reorderChatsByRecent(chatsArray), error: null });
  },

  /** Keep WebSocket-upserted chats when a stale REST list loads. */
  mergeChatsFromServer: (serverChats, localChats) => {
    const serverArr = Array.isArray(serverChats) ? serverChats : [];
    const localArr = Array.isArray(localChats) ? localChats : [];
    const byId = new Map();
    for (const chat of localArr) {
      if (chat?.id != null && chat.id !== '') {
        byId.set(String(chat.id), chat);
      }
    }
    for (const chat of serverArr) {
      if (chat?.id == null || chat.id === '') continue;
      const key = String(chat.id);
      byId.set(key, byId.has(key) ? mergeChatRecord(byId.get(key), chat) : chat);
    }
    return reorderChatsByRecent([...byId.values()]);
  },

  upsertChat: (chat) => {
    if (chat?.id == null || chat.id === '') return;
    const cid = String(chat.id);
    set((state) => {
      const exists = state.chats.some((item) => String(item?.id) === cid);
      const nextChats = exists
        ? state.chats.map((item) =>
            String(item?.id) === cid ? mergeChatRecord(item, chat) : item,
          )
        : [chat, ...state.chats];
      const next = { chats: reorderChatsByRecent(nextChats) };
      if (state.currentChat && String(state.currentChat.id) === cid) {
        next.currentChat = mergeChatRecord(state.currentChat, chat);
      }
      return next;
    });
  },

  removeChat: (chatId) => {
    const key = chatId != null ? String(chatId) : '';
    if (!key) return;
    set((state) => {
      const next = {
        chats: state.chats.filter((c) => String(c?.id) !== key),
      };
      if (state.currentChat && String(state.currentChat.id) === key) {
        next.currentChat = null;
        next.messages = [];
      }
      return next;
    });
  },

  /** After profile avatar upload/remove — refresh list, header, and open messages immediately. */
  patchUserProfileInChats: (userId, { profilePicture } = {}) => {
    const uid = Number(userId);
    if (!Number.isFinite(uid)) return;

    const revision = Date.now();
    const bustedPicture =
      profilePicture != null && String(profilePicture).trim() !== ''
        ? appendCacheBust(stripMediaCacheKey(profilePicture), revision)
        : null;

    const patchUser = (user) => {
      if (!user || Number(user.id) !== uid) return user;
      return {
        ...user,
        profilePicture: bustedPicture,
        avatar: bustedPicture,
        avatarRevision: revision,
      };
    };

    const patchChat = (chat) => {
      if (!chat) return chat;
      let next = chat;
      if (chat.otherUser) {
        const patched = patchUser(chat.otherUser);
        if (patched !== chat.otherUser) next = { ...next, otherUser: patched };
      }
      if (Array.isArray(chat.members) && chat.members.length > 0) {
        const members = chat.members.map((m) => patchUser(m));
        if (members.some((m, i) => m !== chat.members[i])) {
          next = { ...next, members };
        }
      }
      return next;
    };

    set((state) => ({
      chats: state.chats.map(patchChat),
      currentChat: patchChat(state.currentChat),
      messages: state.messages.map((message) => {
        if (!message?.sender || Number(message.sender.id) !== uid) return message;
        return { ...message, sender: patchUser(message.sender) };
      }),
    }));
  },

  mergeChatSenderIntoOtherUser: (chatId, sender) => {
    if (!chatId || !sender?.id) return;
    const sid = Number(sender.id);
    const key = String(chatId);
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (String(chat.id) !== key || !chat.otherUser) return chat;
        if (Number(chat.otherUser.id) !== sid) return chat;
        const rawPic =
          sender.profilePicture !== undefined && sender.profilePicture !== null
            ? sender.profilePicture
            : chat.otherUser.profilePicture;
        const nextPic =
          rawPic != null && String(rawPic).trim() !== ''
            ? appendCacheBust(rawPic)
            : rawPic;
        return {
          ...chat,
          otherUser: {
            ...chat.otherUser,
            username: sender.username ?? chat.otherUser.username,
            firstName: sender.firstName ?? chat.otherUser.firstName,
            lastName: sender.lastName ?? chat.otherUser.lastName,
            profilePicture: nextPic,
            avatarRevision: Date.now(),
          },
        };
      }),
    }));
  },
  
  setCurrentChat: (chat) => {
    // just update current chat and clear messages;
    // the page component is responsible for fetching history
    set((state) => {
      const prevId = state.currentChat?.id;
      const nextId = chat?.id;
      // Same chat (normalize id types — e.g. list uses string, header uses number) must NOT
      // clear messages; that was breaking repeated forwards and racing history loads.
      if (
        prevId != null &&
        nextId != null &&
        String(prevId) === String(nextId)
      ) {
        return {
          ...state,
          currentChat: mergeChatRecord(state.currentChat, chat),
        };
      }
      return {
        currentChat: chat,
        messages: [],
        error: null,
      };
    });
  },
  
  setMessages: (messages) => {
    const messagesArray = Array.isArray(messages) ? messages : [];
    const normalize = get().normalizeMessage;
    set({ messages: messagesArray.map(normalize) });
  },
  
  addMessage: (message) => {
    const resolvedId = message?.id ?? message?._id;
    if (!resolvedId) return;
    const withId =
      resolvedId === message.id ? message : { ...message, id: resolvedId };

    set((state) => {
      const normalize = get().normalizeMessage;
      const normalizedMessage = normalize(withId);
      const nid = String(normalizedMessage.id ?? resolvedId);
      const messageExists = state.messages.some(
        (m) => String(m.id ?? m._id) === nid
      );
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
  
  // Always create a new set for reactivity when updating online users
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
  },

  updateChatLastMessage: (chatId, { content, timestamp, senderId, messageType }) => {
    if (!chatId) return;
    const key = typeof chatId === 'string' ? chatId : String(chatId);
    set((state) => {
      const nextPreview = typeof content === 'string' ? content : String(content ?? '');
      const patch = {
        lastMessage: nextPreview,
        lastMessageContent: nextPreview,
        lastMessageTime: timestamp,
        lastMessageSenderId: senderId,
        ...(messageType != null && messageType !== ''
          ? { lastMessageType: String(messageType).toUpperCase() }
          : {}),
      };
      return applyChatLastMessagePatch(state, key, patch);
    });
  },

  // add to unread counter
  incrementUnreadCount: (chatId) => {
    const key = String(chatId);
    set((state) => ({
      chats: state.chats.map(chat =>
          String(chat.id) === key
              ? { ...chat, unreadCount: (chat.unreadCount || 0) + 1 }
              : chat
      )
    }));
  },

  // reset the counter of unread messages
  resetUnreadCount: (chatId) => {
    const key = String(chatId);
    set((state) => ({
      chats: state.chats.map(chat =>
          String(chat.id) === key
              ? { ...chat, unreadCount: 0 }
              : chat
      )
    }));
  },

  // deleting a message from the list
  removeMessage: (messageId) => {
    const { currentChat } = get();
    const chatId = currentChat?.id;
    recordSharedMediaMessageDeleted(chatId, messageId);
    const messageKey = String(messageId);
    set((state) => {
      const deletedMsg = state.messages.find((msg) => messageIdKey(msg) === messageKey);
      const messages = state.messages.filter((msg) => messageIdKey(msg) !== messageKey);
      const next = { messages };

      if (!chatId || !deletedMsg) return next;

      const chatRecord = state.chats.find((c) => String(c.id) === String(chatId)) ?? state.currentChat;
      const deletedTimeMs = deletedMsg.timestamp ? new Date(deletedMsg.timestamp).getTime() : null;
      const listLastMs = chatLastPreviewTimeMs(chatRecord);
      const wasLastInLoaded = state.messages.length > 0
        && messageIdKey(state.messages[state.messages.length - 1]) === messageKey;
      const wasChatListPreview = deletedTimeMs != null
        && (listLastMs == null || deletedTimeMs >= listLastMs - 1000);

      if (!wasLastInLoaded && !wasChatListPreview) return next;

      const lastRemaining = messages.length > 0 ? messages[messages.length - 1] : null;
      const patch = buildLastMessagePreviewPatch(lastRemaining);
      return { ...next, ...applyChatLastMessagePatch(state, chatId, patch) };
    });
  },

  // updating message text (and optional messageType after caption edits)
  updateMessageContent: (messageId, newContent, editedAt, messageType) => {
    const key = String(messageId);
    set((state) => ({
      messages: state.messages.map(msg =>
          String(msg.id ?? msg._id) === key
              ? {
                  ...msg,
                  content: newContent ?? '',
                  ...(editedAt != null && editedAt !== ''
                    ? { isEdited: true, editedAt }
                    : {}),
                  ...(messageType != null ? { messageType } : {}),
                }
              : msg
      ),
    }));
  },

  // adding online user
  addOnlineUser: (userId) => {
    set((state) => ({
      onlineUsers: new Set([...state.onlineUsers, userId])
    }));
  },

  // deleting online user
  removeOnlineUser: (userId) => {
    set((state) => {
      const newSet = new Set(state.onlineUsers);
      newSet.delete(userId);
      return { onlineUsers: newSet };
    });
  },

  // deleting an attachment
  removeAttachment: (messageId, attachmentId) => {
    const { currentChat } = get();
    recordSharedMediaAttachmentDeleted(currentChat?.id, messageId, attachmentId);
    set((state) => ({
      messages: state.messages.map(msg =>
          msg.id === messageId
              ? {
                ...msg,
                attachments: msg.attachments?.filter(a => a.id !== attachmentId) || []
              }
              : msg
      )
    }));
  },

  // adding an attachment
  addAttachment: (messageId, attachment) => {
    set((state) => ({
      messages: state.messages.map(msg =>
          msg.id === messageId
              ? {
                ...msg,
                attachments: [...(msg.attachments || []), attachment]
              }
              : msg
      )
    }));
  },

  updateMessageReactions: (messageId, reactions) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        String(msg.id) === String(messageId) ? { ...msg, reactions: reactions ?? [] } : msg,
      ),
    }));
  },
}));

export default useChatStore;