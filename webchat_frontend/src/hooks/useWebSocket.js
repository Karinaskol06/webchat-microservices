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
        if (event?.type === 'MESSAGE_SENT' && event.message) {
          addMessage(event.message);

          const senderId = event.message?.sender?.id;
          const isIncoming =
            typeof senderId === 'number' &&
            typeof currentUserId === 'number' &&
            senderId !== currentUserId;

          if (isIncoming) {
            if (markReadTimeoutRef.current) {
              clearTimeout(markReadTimeoutRef.current);
            }
            markReadTimeoutRef.current = setTimeout(() => {
              chatService.markAsRead(currentChatId).catch(() => {});
            }, 250);
          }
        }
      },

      onTyping: (event) => {
        if (event?.type === 'TYPING') {
          // Handle both possible field names
          const isTyping = event.typing ?? event.isTyping ?? false;
          useChatStore.getState().setTyping(event.userId, isTyping);
        }
      },

      onRead: (event) => {
        if (event?.type === 'READ_RECEIPT') {
          if (Array.isArray(event.messageIds) && event.messageIds.length > 0) {
            markMessagesRead(event.messageIds);
          } else if (event.messageId) {
            markMessagesRead([event.messageId]);
          }
        }
      },
    });

    return () => {
      unsubscribe();
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
  }, [user, currentChatId, currentUserId, addMessage, markMessagesRead]);
};

export default useWebSocket;

