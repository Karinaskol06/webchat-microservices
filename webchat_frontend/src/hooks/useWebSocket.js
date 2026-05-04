import { useEffect, useRef } from 'react';
import useChatStore from '../store/useChatStore';
import chatService from '../services/chatService';
import {
  connectWebSocket,
  disconnectWebSocket,
  subscribeToChat,
  subscribeToUserChatEvents,
} from '../utils/websocket';

const useWebSocket = (user, currentChatId, currentUserId) => {
  const markReadTimeoutRef = useRef(null);

  /** Keep latest ids without re-running the subscribe effect when unrelated store slices change */
  const chatRoutingRef = useRef({ chatId: null, userId: null });
  chatRoutingRef.current = { chatId: currentChatId, userId: currentUserId };

  // Connect to WebSocket on mount when user is available
  useEffect(() => {
    if (user) {
      connectWebSocket();
      return () => {
        disconnectWebSocket();
      };
    }
  }, [user]);

  // Subscribe to WebSocket events for the currently selected chat
  useEffect(() => {
    if (!user || !currentChatId) return;

    const unsubscribe = subscribeToChat(currentChatId, {
      onMessage: (event) => {
        console.log('WebSocket onMessage:', event);

        const routing = chatRoutingRef.current;

        /** Already unwrapped by websocket.js except legacy wrappers */
        const message =
          event?.type === 'MESSAGE_SENT' && event.message != null ? event.message : event;

        if (!message || typeof message !== 'object') return;

        const store = useChatStore.getState();
        store.addMessage(message);

        const senderId = message.senderId || message.sender?.id;
        const isIncoming =
          senderId && Number(senderId) !== Number(routing.userId);

        const lastMessageText =
          message.content ||
          (message.attachments?.length > 0
            ? getAttachmentsPreview(message.attachments)
            : 'Attachment');

        if (routing.chatId) {
          store.updateChatLastMessage(routing.chatId, {
            content: lastMessageText,
            timestamp: message.timestamp,
            senderId,
          });
        }

        if (isIncoming && routing.chatId) {
          store.incrementUnreadCount(routing.chatId);

          if (markReadTimeoutRef.current) {
            clearTimeout(markReadTimeoutRef.current);
          }
          markReadTimeoutRef.current = setTimeout(() => {
            chatService.markAsRead(routing.chatId).catch(() => {});
            useChatStore.getState().resetUnreadCount(routing.chatId);
          }, 500);
        }
      },

      // processing notifications on typing
      onTyping: (event) => {
        console.log('WebSocket onTyping:', event);
        const isTyping = event.typing ?? event.isTyping ?? false;
        useChatStore.getState().setTyping(event.userId, isTyping);
      },

      // processing notifications on read
      onRead: (event) => {
        console.log('WebSocket onRead:', event);
        const mk = useChatStore.getState().markMessagesRead;
        if (event.messageIds && event.messageIds.length > 0) {
          mk(event.messageIds);
        } else if (event.messageId) {
          mk([event.messageId]);
        }
      },

      // processing notifications on delete
      onMessageDeleted: (event) => {
        console.log('WebSocket onMessageDeleted:', event);
        if (event.messageId) {
          useChatStore.getState().removeMessage(event.messageId);
        }
      },

      // processing notifications on editing
      onMessageEdited: (event) => {
        console.log('WebSocket onMessageEdited:', event);
        if (event.messageId && event.newContent) {
          useChatStore.getState().updateMessageContent(event.messageId, event.newContent);
        }
      },

      // processing statuses
      onPresence: (event) => {
        console.log('WebSocket onPresence:', event);
        if (event.type === 'USER_JOINED') {
          useChatStore.getState().addOnlineUser(event.userId);
        } else if (event.type === 'USER_LEFT') {
          useChatStore.getState().removeOnlineUser(event.userId);
        }
      },

      // processing attachments
      onAttachment: (event) => {
        console.log('WebSocket onAttachment:', event);
        if (event.type === 'DELETED' && event.attachmentId && event.messageId) {
          useChatStore.getState().removeAttachment(event.messageId, event.attachmentId);
        } else if (event.type === 'ADDED' && event.attachment && event.messageId) {
          useChatStore.getState().addAttachment(event.messageId, event.attachment);
        }
      }
    });

    return () => {
      unsubscribe();
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
  }, [user, currentChatId, currentUserId]);

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

// helper method for preview
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