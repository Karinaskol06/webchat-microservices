import { useEffect, useMemo, useRef } from 'react';
import useChatStore from '../store/useChatStore';
import useChatFolderStore from '../store/useChatFolderStore';
import chatService from '../services/chatService';
import {
  connectWebSocket,
  disconnectWebSocket,
  subscribeToChat,
  subscribeToUserChatEvents,
} from '../utils/websocket';
import {
  WEBCHAT_ACTIVATE_CHAT,
  WEBCHAT_CHAT_CREATED,
  WEBCHAT_CHAT_DELETED,
  WEBCHAT_INCOMING_MESSAGE_OPEN_CHAT,
  WEBCHAT_MESSAGES_MARKED_READ,
} from '../constants/chatEvents';
import { getMessagePreviewText } from '../utils/personalSpace';

const normalizeWsMessagePayload = (event) =>
  event?.type === 'MESSAGE_SENT' && event.message != null ? event.message : event;

const applyRemoteChatDeleted = (chatId) => {
  const key = chatId != null ? String(chatId) : '';
  if (!key) return;
  useChatStore.getState().removeChat(key);
  useChatFolderStore.getState().assignChatToFolder(key, null);
  window.dispatchEvent(new CustomEvent(WEBCHAT_CHAT_DELETED, { detail: { chatId: key } }));
};

const applyRemoteChatUpsert = (chat) => {
  if (!chat?.id) return;
  useChatStore.getState().upsertChat(chat);
  window.dispatchEvent(new CustomEvent(WEBCHAT_CHAT_CREATED, { detail: { chat } }));
};

const resolveChatPayload = (payload) => payload?.chat ?? payload;

/** Last-line preview — must match sidebar + server fields */
const getLastMessagePreview = (message) => {
  const text = getMessagePreviewText(message);
  return text || 'Attachment';
};

const processIncomingMessage = (message, topicChatIdFallback, routingRef, markReadTimeoutRef) => {
  if (!message || typeof message !== 'object') return;

  const store = useChatStore.getState();
  const routing = routingRef.current;
  const sid = routing.userId;
  const openId = store.currentChat?.id;

  const senderId = message.senderId || message.sender?.id;
  const isIncoming = Boolean(senderId && Number(senderId) !== Number(sid));
  const lastMessageText = getLastMessagePreview(message);
  const topicChatId = String(message.chatId ?? topicChatIdFallback ?? '');

  store.updateChatLastMessage(topicChatId, {
    content: lastMessageText,
    timestamp: message.timestamp,
    senderId,
    messageType: message.messageType,
  });

  if (message.sender) {
    store.mergeChatSenderIntoOtherUser(topicChatId, message.sender);
  }

  const isOwnForward = Boolean(
    !isIncoming && (message.forwardedFrom != null || message.forwardedFromUserId != null),
  );

  const isFocused =
    openId != null && openId !== '' && String(openId) === topicChatId;

  if (isOwnForward && !isFocused) {
    window.dispatchEvent(
      new CustomEvent(WEBCHAT_ACTIVATE_CHAT, {
        detail: { chatId: topicChatId, message },
      }),
    );
    return;
  }

  if (isFocused) {
    store.addMessage(message);
    if (isIncoming) {
      window.dispatchEvent(
        new CustomEvent(WEBCHAT_INCOMING_MESSAGE_OPEN_CHAT, {
          detail: { chatId: topicChatId, message },
        }),
      );
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
      }
      markReadTimeoutRef.current = window.setTimeout(() => {
        chatService
          .markAsRead(topicChatId)
          .then(() => {
            window.dispatchEvent(
              new CustomEvent(WEBCHAT_MESSAGES_MARKED_READ, {
                detail: { chatId: topicChatId },
              }),
            );
            useChatStore.getState().resetUnreadCount(topicChatId);
          })
          .catch(() => {});
      }, 500);
    }
  } else if (isIncoming) {
    store.incrementUnreadCount(topicChatId);
  }
};

const useWebSocket = (user, currentChatId, currentUserId, userEventHandlers = {}) => {
  const markReadTimeoutRef = useRef(null);
  /** serial id list so subscriptions track chat list membership */
  const chats = useChatStore((s) => s.chats);

  const chatIdsKey = useMemo(() => {
    const ids = Array.isArray(chats) ? chats.map((c) => c?.id).filter(Boolean) : [];
    return [...new Set(ids.map(String))].sort().join(',');
  }, [chats]);

  const routingRef = useRef({
    chatId: currentChatId,
    userId: currentUserId,
  });

  useEffect(() => {
    routingRef.current = { chatId: currentChatId, userId: currentUserId };
  }, [currentChatId, currentUserId]);

  const presenceBumpTimersRef = useRef({});

  const bumpPresenceLater = (chatId) => {
    if (!chatId) return;
    const key = String(chatId);
    if (presenceBumpTimersRef.current[key]) {
      clearTimeout(presenceBumpTimersRef.current[key]);
    }
    presenceBumpTimersRef.current[key] = window.setTimeout(() => {
      delete presenceBumpTimersRef.current[key];
      window.dispatchEvent(
        new CustomEvent('webchat:presence-refresh', { detail: { chatId } }),
      );
    }, 250);
  };

  useEffect(() => {
    if (user) {
      connectWebSocket();
      return () => {
        disconnectWebSocket();
      };
    }
  }, [user]);

  /** Every chat: message stream + presence (updates list preview, unread, avatars). */
  useEffect(() => {
    if (!user) return undefined;

    const ids = [
      ...new Set(
        [chatIdsKey, currentChatId]
          .flatMap((value) =>
            String(value || '')
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean),
          ),
      ),
    ];
    if (ids.length === 0) return undefined;

    const unsubs = ids.map((id) =>
      subscribeToChat(id, {
        onChatCreated: (payload) => {
          applyRemoteChatUpsert(resolveChatPayload(payload));
        },
        onChatDeleted: (event) => {
          applyRemoteChatDeleted(event?.chatId ?? event?.id ?? id);
        },
        onMessage: (rawPayload) => {
          const message = normalizeWsMessagePayload(rawPayload);
          processIncomingMessage(message, id, routingRef, markReadTimeoutRef);
        },
        onPresence: () => {
          bumpPresenceLater(id);
        },
      }),
    );

    return () => {
      unsubs.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.debug('Unsubscribe sidebar chat', e);
        }
      });
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
  }, [user, chatIdsKey, currentChatId]);

  /** Focused chat: typing / read receipts / deletes / edits / attachments — not messages (handled above). */
  useEffect(() => {
    if (!user || !currentChatId) return;

    const unsubscribe = subscribeToChat(currentChatId, {
      onTyping: (event) => {
        const isTyping = event.typing ?? event.isTyping ?? false;
        useChatStore.getState().setTyping(event.userId, isTyping);
      },
      onRead: (event) => {
        const mk = useChatStore.getState().markMessagesRead;
        if (event.messageIds && event.messageIds.length > 0) {
          mk(event.messageIds);
        } else if (event.messageId) {
          mk([event.messageId]);
        }
      },
      onMessageDeleted: (event) => {
        if (event.messageId) {
          useChatStore.getState().removeMessage(event.messageId);
        }
      },
      onMessageEdited: (event) => {
        if (event.messageId == null || event.messageId === '') return;
        useChatStore.getState().updateMessageContent(
          event.messageId,
          event.newContent ?? '',
          event.editedAt,
          event.messageType,
        );
      },
      onMessageReactionUpdated: (event) => {
        if (event.messageId == null || event.messageId === '') return;
        useChatStore.getState().updateMessageReactions(
          event.messageId,
          event.reactions ?? [],
        );
      },
      onAttachment: (event) => {
        if (event.type === 'DELETED' && event.attachmentId && event.messageId) {
          useChatStore.getState().removeAttachment(event.messageId, event.attachmentId);
        } else if (event.type === 'ADDED' && event.attachment && event.messageId) {
          useChatStore.getState().addAttachment(event.messageId, event.attachment);
        }
      },
    });

    return () => unsubscribe();
  }, [user, currentChatId]);

  const onRoomMemberInvite = userEventHandlers.onRoomMemberInvite;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserChatEvents({
      userId: user?.id,
      onChatCreated: (payload) => {
        applyRemoteChatUpsert(resolveChatPayload(payload));
      },
      onChatUpdated: (chat) => {
        applyRemoteChatUpsert(chat);
      },
      onChatDeleted: (event) => {
        applyRemoteChatDeleted(event?.chatId ?? event?.id);
      },
      onIncomingChatMessage: (event) => {
        const chat = event?.chat;
        const message = event?.message;
        if (chat?.id) {
          applyRemoteChatUpsert(chat);
        }
        processIncomingMessage(message, chat?.id, routingRef, markReadTimeoutRef);
      },
      onRoomMemberInvite,
    });
    return () => unsubscribe();
  }, [user, onRoomMemberInvite]);

  return null;
};

export default useWebSocket;
