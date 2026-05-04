import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// Dev: use relative URL so Vite proxies /ws to the gateway (no cross-origin SockJS / CORS).
// Prod / custom: set VITE_API_BASE_URL (e.g. https://api.example.com).
const WS_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8089').replace(/\/$/, '');

let stompClient = null;
let pendingChatSubscriptions = [];
let userEventSubscriptions = [];
let pendingUserEventHandlers = [];

export const connectWebSocket = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No token, WebSocket connection aborted');
    return null;
  }

  if (stompClient?.active) {
    return stompClient;
  }

  // Same host as REST API (api-gateway routes /ws/** to chat-service)
  const socket = new SockJS(`${WS_BASE_URL}/ws/chat`, null, {
    transports: ['websocket', 'xhr-streaming', 'xhr-polling'],
    withCredentials: true
  });
  
  stompClient = new Client({
    webSocketFactory: () => socket,
    connectHeaders: {
      Authorization: `Bearer ${token}`
    },
    debug: (str) => {
      console.log('STOMP: ' + str);
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    onConnect: () => {
      console.log('WebSocket connected');

      // attach any subscriptions that were requested before connection
      pendingChatSubscriptions.forEach((sub) => {
        attachChatSubscriptions(sub);
      });
      pendingUserEventHandlers.forEach((handlers) => {
        attachUserEventSubscriptions(handlers);
      });
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
    },
    onStompError: (frame) => {
      console.error('STOMP error:', frame);
    }
  });
  
  stompClient.activate();
  return stompClient;
};

const attachChatSubscriptions = (subscription) => {
  if (!stompClient || !stompClient.connected) {
    console.warn('Cannot attach subscriptions - not connected');
    return;
  }

  if (subscription._subscriptions?.length) {
    subscription._subscriptions.forEach((s) => {
      try {
        s.unsubscribe();
      } catch (e) {
        console.debug('Unsubscribe before reattach:', e);
      }
    });
    subscription._subscriptions = [];
  }

  const { chatId, handlers } = subscription;
  const subs = [];

  // subscription to messages
  if (handlers.onMessage) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/messages`, (frame) => {
        try {
          const event = JSON.parse(frame.body);
          console.log('Message received:', event);
          if (event.type === 'MESSAGE_DELETED') {
            handlers.onMessageDeleted?.(event);
            return;
          }
          if (event.type === 'MESSAGE_EDITED') {
            handlers.onMessageEdited?.(event);
            return;
          }
          // Text: MessageSentEvent { type, timestamp, message: ChatMessageDTO }
          const payload =
            event.type === 'MESSAGE_SENT' && event.message != null
              ? event.message
              : event;
          handlers.onMessage(payload);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      })
    );
  }

  // subscription to typing
  if (handlers.onTyping) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/typing`, (frame) => {
        try {
          const event = JSON.parse(frame.body);
          console.log('Typing event:', event);
          // event format: { userId: 123, typing: true }
          handlers.onTyping(event);
        } catch (error) {
          console.error('Failed to parse typing event:', error);
        }
      })
    );
  }

  // subscription to reading messages
  if (handlers.onRead) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/read`, (frame) => {
        try {
          const event = JSON.parse(frame.body);
          console.log('Read receipt:', event);
          // event format: { userId: 123, messageIds: ['id1', 'id2'] }
          handlers.onRead(event);
        } catch (error) {
          console.error('Failed to parse read receipt:', error);
        }
      })
    );
  }

  // subscription to statuses
  if (handlers.onPresence) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/presence`, (frame) => {
        try {
          const event = JSON.parse(frame.body);
          console.log('Presence event:', event);
          // event format: { userId: 123, type: 'USER_JOINED' or 'USER_LEFT' }
          handlers.onPresence(event);
        } catch (error) {
          console.error('Failed to parse presence event:', error);
        }
      })
    );
  }

  // subscription to message deletion
  if (handlers.onMessageDeleted) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/deleted`, (frame) => {
        try {
          const event = JSON.parse(frame.body);
          console.log('Message deleted:', event);
          // event format: { messageId: '123', chatId: 'chat123', deletedByUserId: 456 }
          handlers.onMessageDeleted(event);
        } catch (error) {
          console.error('Failed to parse delete event:', error);
        }
      })
    );
  }

  // subscription to message editing
  if (handlers.onMessageEdited) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/edited`, (frame) => {
        try {
          const event = JSON.parse(frame.body);
          console.log('Message edited:', event);
          // event format: { messageId: '123', chatId: 'chat123', newContent: 'new text', editedByUserId: 456 }
          handlers.onMessageEdited(event);
        } catch (error) {
          console.error('Failed to parse edit event:', error);
        }
      })
    );
  }

  // subscription to attachments
  if (handlers.onAttachment) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/attachment`, (frame) => {
        try {
          const event = JSON.parse(frame.body);
          console.log('Attachment event:', event);
          // event format: { messageId: '123', attachment: {...}, type: 'ADDED' or 'DELETED' }
          handlers.onAttachment(event);
        } catch (error) {
          console.error('Failed to parse attachment event:', error);
        }
      })
    );
  }

  subscription._subscriptions = subs;
};

export const subscribeToChat = (chatId, handlers) => {
  console.log(`Subscribing to chat ${chatId} with handlers:`, Object.keys(handlers));
  
  const subscription = { chatId, handlers, _subscriptions: [] };
  pendingChatSubscriptions.push(subscription);

  if (stompClient && stompClient.connected) {
    attachChatSubscriptions(subscription);
  }

  // Return unsubscribe function
  return () => {
    console.log(`Unsubscribing from chat ${chatId}`);
    pendingChatSubscriptions = pendingChatSubscriptions.filter(
      (sub) => sub !== subscription
    );

    if (subscription._subscriptions) {
      subscription._subscriptions.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch (e) {
          console.error('Error unsubscribing:', e);
        }
      });
      subscription._subscriptions = [];
    }
  };
};

export const disconnectWebSocket = () => {
  console.log('Disconnecting WebSocket...');
  if (stompClient) {
    // Unsubscribe from all pending subscriptions
    pendingChatSubscriptions.forEach((sub) => {
      if (sub._subscriptions) {
        sub._subscriptions.forEach((s) => {
          try {
            s.unsubscribe();
            // eslint-disable-next-line no-empty,no-unused-vars
          } catch (e) {}
        });
      }
    });
    userEventSubscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.debug("Error unsubscribing user event stream:", error);
      }
    });
    userEventSubscriptions = [];
    pendingUserEventHandlers = [];
    stompClient.deactivate();
    stompClient = null;
    pendingChatSubscriptions = [];
  }
};

const attachUserEventSubscriptions = ({ onChatCreated } = {}) => {
  if (!stompClient || !stompClient.connected) return [];
  const subscriptions = [];
  if (onChatCreated) {
    subscriptions.push(
      stompClient.subscribe(`/user/queue/chats/new`, (frame) => {
        try {
          onChatCreated(JSON.parse(frame.body));
        } catch (error) {
          console.error("Failed to parse chat created event:", error);
        }
      })
    );
  }
  return subscriptions;
};

export const subscribeToUserChatEvents = ({ onChatCreated } = {}) => {
  const handlers = { onChatCreated };
  pendingUserEventHandlers.push(handlers);
  const subscriptions = attachUserEventSubscriptions(handlers);
  userEventSubscriptions.push(...subscriptions);

  return () => {
    subscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch (error) {
        console.debug("Error unsubscribing user event handler:", error);
      }
    });
    userEventSubscriptions = userEventSubscriptions.filter(
      (sub) => !subscriptions.includes(sub)
    );
    pendingUserEventHandlers = pendingUserEventHandlers.filter((item) => item !== handlers);
  };
};

export const sendMessage = (destination, payload) => {
  if (stompClient && stompClient.connected) {
    console.log(`Sending message to /app/${destination}:`, payload);
    stompClient.publish({
      destination: `/app/${destination}`,
      body: JSON.stringify(payload)
    });
    return true;
  }
  console.warn('WebSocket not connected, message not sent');
  return false;
};

export const sendChatMessage = (payload) => {
  if (!stompClient || !stompClient.connected) {
    console.error('WebSocket not connected, message not sent');
    return false;
  }

  const message = {
    chatId: payload.chatId,
    content: payload.content || null,  // can be null only for messages with attachments
    attachmentIds: payload.attachmentIds || [],
    type: payload.type || 'TEXT'
  };
  console.log('Sending message via WebSocket:', message);

  stompClient.publish({
    destination: '/app/chat.send',
    body: JSON.stringify(message)
  });

  return true;
};

export const sendTypingEvent = (payload) => {
  const event = {
    chatId: payload.chatId,
    typing: payload.typing
  };
  return sendMessage('chat.typing', event);
};

export default {
  connectWebSocket,
  disconnectWebSocket,
  sendMessage,
  sendChatMessage,
  sendTypingEvent,
  subscribeToChat,
  subscribeToUserChatEvents
};