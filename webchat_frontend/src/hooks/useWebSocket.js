import { useEffect, useMemo, useRef } from 'react';
import useChatStore from '../store/useChatStore';
import chatService from '../services/chatService';
import {
  connectWebSocket,
  disconnectWebSocket,
  subscribeToChat,
  subscribeToUserChatEvents,
} from '../utils/websocket';

const normalizeWsMessagePayload = (event) =>
  event?.type === 'MESSAGE_SENT' && event.message != null ? event.message : event;

/** Last-line preview — must match sidebar + server fields */
const getLastMessagePreview = (message) => {
  const text =
    message.content ||
    (message.attachments?.length > 0 ? getAttachmentsPreview(message.attachments) : '') ||
    'Attachment';
  return typeof text === 'string' ? text : String(text);
};

const useWebSocket = (user, currentChatId, currentUserId) => {
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
  routingRef.current = { chatId: currentChatId, userId: currentUserId };

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
    if (!user || !chatIdsKey) return undefined;

    const ids = chatIdsKey.split(',').filter(Boolean);

    const unsubs = ids.map((id) =>
      subscribeToChat(id, {
        onMessage: (rawPayload) => {
          const message = normalizeWsMessagePayload(rawPayload);
          if (!message || typeof message !== 'object') return;

          const store = useChatStore.getState();
          const routing = routingRef.current;
          const sid = routing.userId;
          const openId = routing.chatId;

          const senderId = message.senderId || message.sender?.id;
          const isIncoming = Boolean(senderId && Number(senderId) !== Number(sid));
          const lastMessageText = getLastMessagePreview(message);

          store.updateChatLastMessage(id, {
            content: lastMessageText,
            timestamp: message.timestamp,
            senderId,
          });

          if (message.sender) {
            store.mergeChatSenderIntoOtherUser(id, message.sender);
          }

          const isFocused = String(openId) === String(id);
          if (isFocused) {
            store.addMessage(message);
            if (isIncoming) {
              if (markReadTimeoutRef.current) {
                clearTimeout(markReadTimeoutRef.current);
              }
              markReadTimeoutRef.current = window.setTimeout(() => {
                chatService.markAsRead(id).catch(() => {});
                useChatStore.getState().resetUnreadCount(id);
              }, 500);
            }
          } else if (isIncoming) {
            store.incrementUnreadCount(id);
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chatIdsKey encodes memberships
  }, [user, chatIdsKey]);

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

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserChatEvents({
      onChatCreated: (chat) => {
        useChatStore.getState().upsertChat(chat);
      },
    });
    return () => unsubscribe();
  }, [user]);

  return null;
};

const getAttachmentsPreview = (attachments) => {
  if (!attachments || attachments.length === 0) return '';
  if (attachments.length === 1) {
    const att = attachments[0];
    if (att.isImage) return 'Image';
    if (att.fileType === 'VIDEO') return 'Video';
    return `${att.filename || 'File'}`;
  }
  return `${attachments.length} files`;
};

export default useWebSocket;
