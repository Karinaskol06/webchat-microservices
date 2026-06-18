import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

import { resolveApiBaseUrl } from './apiBaseUrl';

const WS_BASE_URL = resolveApiBaseUrl();

let stompClient = null;
let pendingChatSubscriptions = [];
let userEventSubscriptions = [];
let pendingUserEventHandlers = [];
/** JWT string last used for an active STOMP session — prevents session fixation if token changes while client is still active */
let lastBoundToken = null;

const isStompConnected = () => Boolean(stompClient && stompClient.connected);

export const connectWebSocket = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No token, WebSocket connection aborted');
    return null;
  }

  if (stompClient?.active) {
    if (lastBoundToken === token) {
      return stompClient;
    }
    disconnectWebSocket();
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
      lastBoundToken = token;

      // attach any subscriptions that were requested before connection
      pendingChatSubscriptions.forEach((sub) => {
        attachChatSubscriptions(sub);
      });
      pendingUserEventHandlers.forEach((handlers) => {
        const subs = attachUserEventSubscriptions(handlers);
        userEventSubscriptions.push(...subs);
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
  if (!isStompConnected()) {
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
          if (event.type === 'CHAT_CREATED') {
            handlers.onChatCreated?.(event.chat ?? event);
            return;
          }
          if (event.type === 'CHAT_DELETED') {
            handlers.onChatDeleted?.(event);
            return;
          }
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

  if (handlers.onMessageReactionUpdated) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/reactions`, (frame) => {
        try {
          const event = JSON.parse(frame.body);
          handlers.onMessageReactionUpdated(event);
        } catch (error) {
          console.error('Failed to parse reaction event:', error);
        }
      }),
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
  console.debug(`Subscribing to chat ${chatId} with handlers:`, Object.keys(handlers));
  
  const subscription = { chatId, handlers, _subscriptions: [] };
  pendingChatSubscriptions.push(subscription);

  if (isStompConnected()) {
    attachChatSubscriptions(subscription);
  }

  // Return unsubscribe function
  return () => {
    console.debug(`Unsubscribing from chat ${chatId}`);
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
    lastBoundToken = null;
  }
};

const routeUserInboxEvent = (event, handlers = {}) => {
  const type = event?.type;
  if (type === 'CHAT_CREATED') {
    handlers.onChatCreated?.(event);
    return;
  }
  if (type === 'CHAT_UPDATED') {
    handlers.onChatUpdated?.(event.chat ?? event);
    return;
  }
  if (type === 'CHAT_DELETED') {
    handlers.onChatDeleted?.(event);
    return;
  }
  if (type === 'INCOMING_CHAT_MESSAGE') {
    handlers.onIncomingChatMessage?.(event);
  }
};

const attachUserInboxSubscription = (userId, handlers = {}) => {
  if (!isStompConnected() || userId == null || userId === '') return null;
  return stompClient.subscribe(`/topic/users/${String(userId)}/inbox`, (frame) => {
    try {
      routeUserInboxEvent(JSON.parse(frame.body), handlers);
    } catch (error) {
      console.error('Failed to parse user inbox event:', error);
    }
  });
};

const attachUserEventSubscriptions = ({
  userId,
  onChatCreated,
  onChatUpdated,
  onChatDeleted,
  onIncomingChatMessage,
  onRoomMemberInvite,
} = {}) => {
  if (!isStompConnected()) return [];
  const handlers = {
    onChatCreated,
    onChatUpdated,
    onChatDeleted,
    onIncomingChatMessage,
    onRoomMemberInvite,
  };
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
  if (onChatUpdated) {
    subscriptions.push(
      stompClient.subscribe(`/user/queue/chats/updated`, (frame) => {
        try {
          onChatUpdated(JSON.parse(frame.body));
        } catch (error) {
          console.error("Failed to parse chat updated event:", error);
        }
      })
    );
  }
  if (onChatDeleted) {
    subscriptions.push(
      stompClient.subscribe(`/user/queue/chats/deleted`, (frame) => {
        try {
          onChatDeleted(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse chat deleted event:', error);
        }
      }),
    );
  }
  if (onIncomingChatMessage) {
    subscriptions.push(
      stompClient.subscribe(`/user/queue/messages/incoming`, (frame) => {
        try {
          onIncomingChatMessage(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse incoming chat message event:', error);
        }
      }),
    );
  }
  if (onRoomMemberInvite) {
    subscriptions.push(
      stompClient.subscribe(`/user/queue/rooms/member-invites/new`, (frame) => {
        try {
          onRoomMemberInvite(JSON.parse(frame.body));
        } catch (error) {
          console.error("Failed to parse room member invite event:", error);
        }
      })
    );
  }
  const inboxSub = attachUserInboxSubscription(userId, handlers);
  if (inboxSub) {
    subscriptions.push(inboxSub);
  }
  return subscriptions;
};

export const subscribeToUserChatEvents = ({
  userId,
  onChatCreated,
  onChatUpdated,
  onChatDeleted,
  onIncomingChatMessage,
  onRoomMemberInvite,
} = {}) => {
  const handlers = {
    userId,
    onChatCreated,
    onChatUpdated,
    onChatDeleted,
    onIncomingChatMessage,
    onRoomMemberInvite,
  };
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
  if (isStompConnected()) {
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
  if (!isStompConnected()) {
    console.error('WebSocket not connected, message not sent');
    return false;
  }

  const message = {
    chatId: payload.chatId,
    content: payload.content || null,  // can be null only for messages with attachments
    attachmentIds: payload.attachmentIds || [],
    type: payload.type || 'TEXT',
    replyToMessageId: payload.replyToMessageId || null
  };
  console.log('Sending message via WebSocket:', message);

  stompClient.publish({
    destination: '/app/chat.send',
    body: JSON.stringify(message)
  });

  return true;
};

/** Server copies content and attachments; client cannot edit the forwarded payload. */
export const sendForwardMessage = ({ chatId, forwardSourceMessageId }) => {
  if (!isStompConnected()) {
    console.warn('WebSocket not connected, forward not sent');
    return false;
  }
  const cid = chatId != null ? String(chatId) : '';
  const sid = forwardSourceMessageId != null ? String(forwardSourceMessageId) : '';
  if (!cid || !sid) {
    return false;
  }
  const body = {
    chatId: cid,
    forwardSourceMessageId: sid,
    content: null,
    attachmentIds: [],
    type: 'TEXT',
    replyToMessageId: null
  };
  stompClient.publish({
    destination: '/app/chat.send',
    body: JSON.stringify(body)
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
  sendForwardMessage,
  sendTypingEvent,
  subscribeToChat,
  subscribeToUserChatEvents
};