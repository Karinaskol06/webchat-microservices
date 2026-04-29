import { useEffect, useRef } from 'react';
import useChatStore from '../store/useChatStore';
import chatService from '../services/chatService';
import {
  connectWebSocket,
  disconnectWebSocket,
  subscribeToChat,
} from '../utils/websocket';

const useWebSocket = (user, currentChatId, currentUserId) => {
  const addMessage = useChatStore((state) => state.addMessage);
  const markMessagesRead = useChatStore((state) => state.markMessagesRead);
  const updateChatLastMessage = useChatStore((state) => state.updateChatLastMessage);
  const incrementUnreadCount = useChatStore((state) => state.incrementUnreadCount);
  const removeMessage = useChatStore((state) => state.removeMessage);
  const updateMessageContent = useChatStore((state) => state.updateMessageContent);

  const markReadTimeoutRef = useRef(null);

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

        const isNewMessage = event.type === 'MESSAGE_SENT' ||
            event.attachments !== undefined ||
            event.content !== undefined ||
            event.id;

        if (!isNewMessage) return;

        let message = event;
        if (event.type === 'MESSAGE_SENT' && event.message) {
          message = event.message;
        }

        addMessage(message);

        const senderId = message.senderId || message.sender?.id;
        const isIncoming = senderId && Number(senderId) !== Number(currentUserId);

        const lastMessageText = message.content ||
            (message.attachments?.length > 0 ? getAttachmentsPreview(message.attachments) : 'Attachment');

        updateChatLastMessage(currentChatId, {
          content: lastMessageText,
          timestamp: message.timestamp,
          senderId: senderId
        });

        if (isIncoming) {
          incrementUnreadCount(currentChatId);

          if (markReadTimeoutRef.current) {
            clearTimeout(markReadTimeoutRef.current);
          }
          markReadTimeoutRef.current = setTimeout(() => {
            chatService.markAsRead(currentChatId).catch(() => {});
            useChatStore.getState().resetUnreadCount(currentChatId);
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
        if (event.messageIds && event.messageIds.length > 0) {
          markMessagesRead(event.messageIds);
        } else if (event.messageId) {
          markMessagesRead([event.messageId]);
        }
      },

      // processing notifications on delete
      onMessageDeleted: (event) => {
        console.log('WebSocket onMessageDeleted:', event);
        if (event.messageId) {
          removeMessage(event.messageId);
        }
      },

      // processing notifications on editing
      onMessageEdited: (event) => {
        console.log('WebSocket onMessageEdited:', event);
        if (event.messageId && event.newContent) {
          updateMessageContent(event.messageId, event.newContent);
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
  }, [user, currentChatId, currentUserId, addMessage, markMessagesRead,
    updateChatLastMessage, incrementUnreadCount, removeMessage, updateMessageContent]);

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