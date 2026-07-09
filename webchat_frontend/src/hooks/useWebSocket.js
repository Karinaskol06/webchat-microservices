import { useEffect, useMemo, useRef } from 'react';
import useChatStore from '../store/useChatStore';
import useChatFolderStore from '../store/useChatFolderStore';
import chatService from '../services/chatService';
import {
  acquireWebSocketConnection,
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
import {
  shouldNotifyForIncomingMessage,
  showChatMessageNotification,
} from '../utils/inAppNotifications';
import { claimIncomingMessage } from '../utils/notificationDedup';
import { extractWsChatMessagePayload } from '../utils/wsChatMessagePayload';

const applyIncomingChatMessageEvent = (event, topicChatIdFallback, routingRef, markReadTimeoutRef) => {
  const message = extractWsChatMessagePayload(event);
  if (!message) return;
  processIncomingMessage(message, topicChatIdFallback, routingRef, markReadTimeoutRef);
};

const resolveMessageEventId = (event) => {
  const raw = event?.messageId ?? event?.message_id ?? event?.id ?? event?.message?.id;
  if (raw == null || raw === '') return null;
  return String(raw);
};

const isCurrentChat = (chatId, routingRef) => {
  const current = useChatStore.getState().currentChat?.id ?? routingRef.current.chatId;
  return current != null && chatId != null && String(current) === String(chatId);
};

const applyRemoteMessageDeleted = (event, routingRef) => {
  const messageId = resolveMessageEventId(event);
  if (!messageId) return;
  const eventChatId = event?.chatId;
  if (eventChatId != null && !isCurrentChat(eventChatId, routingRef)) return;
  useChatStore.getState().removeMessage(messageId);
};

const applyRemoteMessageEdited = (event, routingRef) => {
  const messageId = resolveMessageEventId(event);
  if (!messageId) return;
  const eventChatId = event?.chatId;
  if (eventChatId != null && !isCurrentChat(eventChatId, routingRef)) return;
  useChatStore.getState().updateMessageContent(
    messageId,
    event.newContent ?? event.content ?? '',
    event.editedAt,
    event.messageType,
  );
};

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
};

const notifyRemoteChatCreated = (chat) => {
  if (!chat?.id) return;
  applyRemoteChatUpsert(chat);
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
  if (!claimIncomingMessage(message)) return;

  const store = useChatStore.getState();
  const routing = routingRef.current;
  const sid = routing.userId;
  const openId = store.currentChat?.id ?? routing.chatId;

  const senderId = message.senderId || message.sender?.id;
  const isIncoming = Boolean(senderId && Number(senderId) !== Number(sid));
  const lastMessageText = getLastMessagePreview(message);
  const topicChatId = String(message.chatId ?? topicChatIdFallback ?? '');

  const enrichedMessage = {
    ...message,
    chatId: message.chatId ?? topicChatIdFallback ?? topicChatId,
    senderId: message.senderId ?? message.sender?.id,
  };

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
        detail: { chatId: topicChatId, message: enrichedMessage },
      }),
    );
    return;
  }

  if (isFocused) {
    store.addMessage(enrichedMessage);
    if (isIncoming) {
      window.dispatchEvent(
        new CustomEvent(WEBCHAT_INCOMING_MESSAGE_OPEN_CHAT, {
          detail: { chatId: topicChatId, message: enrichedMessage },
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
    if (shouldNotifyForIncomingMessage({ isIncoming, isFocused })) {
      void showChatMessageNotification({
        message: enrichedMessage,
        chatId: topicChatId,
        chatTitle: store.chats.find((c) => String(c.id) === topicChatId)?.groupName,
      });
    }
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
    if (!user?.id) return undefined;
    return acquireWebSocketConnection();
  }, [user?.id]);

  /** Sidebar chats: preview + unread — resubscribe only when chat list membership changes. */
  useEffect(() => {
    if (!user) return undefined;

    const ids = [
      ...new Set(
        chatIdsKey
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    if (ids.length === 0) return undefined;

    const unsubs = ids.map((id) =>
      subscribeToChat(id, {
        onChatCreated: (payload) => {
          notifyRemoteChatCreated(resolveChatPayload(payload));
        },
        onMessage: (rawPayload) => {
          applyIncomingChatMessageEvent(rawPayload, id, routingRef, markReadTimeoutRef);
        },
        onIncomingChatMessage: (event) => {
          applyIncomingChatMessageEvent(event, id, routingRef, markReadTimeoutRef);
        },
        onPresence: () => {
          bumpPresenceLater(id);
        },
        onMessageDeleted: (event) => {
          applyRemoteMessageDeleted(event, routingRef);
        },
        onMessageEdited: (event) => {
          applyRemoteMessageEdited(event, routingRef);
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
  }, [user, chatIdsKey]);

  /** Focused chat: typing / read receipts / deletes / edits / attachments (messages via sidebar subs). */
  useEffect(() => {
    if (!user || !currentChatId) return;

    const focusedHandlers = {
      onMessage: (rawPayload) => {
        applyIncomingChatMessageEvent(rawPayload, currentChatId, routingRef, markReadTimeoutRef);
      },
      onIncomingChatMessage: (event) => {
        applyIncomingChatMessageEvent(event, currentChatId, routingRef, markReadTimeoutRef);
      },
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
        applyRemoteMessageDeleted(event, routingRef);
      },
      onMessageEdited: (event) => {
        applyRemoteMessageEdited(event, routingRef);
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
    };

    const unsubscribe = subscribeToChat(currentChatId, focusedHandlers);

    return () => unsubscribe();
  }, [user, currentChatId]);

  const onRoomMemberInvite = userEventHandlers.onRoomMemberInvite;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserChatEvents({
      userId: user?.id,
      onChatCreated: (payload) => {
        notifyRemoteChatCreated(resolveChatPayload(payload));
      },
      onChatUpdated: (chat) => {
        applyRemoteChatUpsert(chat);
      },
      onChatDeleted: (event) => {
        applyRemoteChatDeleted(event?.chatId ?? event?.id);
      },
      onIncomingChatMessage: (event) => {
        const chat = event?.chat;
        if (chat?.id) {
          applyRemoteChatUpsert(chat);
        }
        const chatKey = String(chat?.id ?? event?.message?.chatId ?? '');
        applyIncomingChatMessageEvent(event, chatKey, routingRef, markReadTimeoutRef);
      },
      onMessageDeleted: (event) => {
        applyRemoteMessageDeleted(event, routingRef);
      },
      onMessageEdited: (event) => {
        applyRemoteMessageEdited(event, routingRef);
      },
      onRoomMemberInvite,
    });
    return () => unsubscribe();
  }, [user, onRoomMemberInvite, chatIdsKey]);

  return null;
};

export default useWebSocket;
