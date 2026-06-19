import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

import { resolveApiBaseUrl } from './apiBaseUrl';

const WS_BASE_URL = resolveApiBaseUrl();

let stompClient = null;
let connectionRefCount = 0;
let pendingChatSubscriptions = [];
let userEventSubscriptions = [];
let pendingUserEventHandlers = [];
/** JWT string last used for an active STOMP session */
let lastBoundToken = null;
const connectionListeners = new Set();

export const isWebSocketConnected = () => Boolean(stompClient && stompClient.connected);

const isStompConnected = isWebSocketConnected;

const notifyConnectionChange = (connected = isStompConnected()) => {
  connectionListeners.forEach((listener) => {
    try {
      listener(connected);
    } catch (error) {
      console.debug('WebSocket connection listener error:', error);
    }
  });
};

const createSockJsSocket = () =>
  new SockJS(`${WS_BASE_URL}/ws/chat`, null, {
    transports: ['websocket', 'xhr-streaming', 'xhr-polling'],
    withCredentials: true,
  });

const buildStompClient = (token) =>
  new Client({
    // Must return a NEW socket on each call so STOMP reconnect works after drops.
    webSocketFactory: () => createSockJsSocket(),
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    debug: import.meta.env.DEV
      ? (str) => {
          if (!str.includes('heart-beat')) {
            console.log('STOMP: ' + str);
          }
        }
      : () => {},
    reconnectDelay: 2000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    connectionTimeout: 15000,
    onConnect: () => {
      console.log('WebSocket connected');
      lastBoundToken = token;
      pendingChatSubscriptions.forEach((sub) => {
        attachChatSubscriptions(sub);
      });
      userEventSubscriptions = [];
      pendingUserEventHandlers.forEach((handlers) => {
        const subs = attachUserEventSubscriptions(handlers);
        userEventSubscriptions.push(...subs);
      });
      notifyConnectionChange(true);
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
      notifyConnectionChange(false);
    },
    onWebSocketClose: () => {
      notifyConnectionChange(false);
    },
    onStompError: (frame) => {
      console.error('STOMP error:', frame);
      notifyConnectionChange(false);
    },
  });

const hardDeactivateClient = () => {
  if (!stompClient) return;
  try {
    stompClient.deactivate();
  } catch (error) {
    console.debug('STOMP deactivate error:', error);
  }
  stompClient = null;
  lastBoundToken = null;
  notifyConnectionChange(false);
};

export const subscribeToConnectionChange = (listener) => {
  connectionListeners.add(listener);
  listener(isStompConnected());
  return () => {
    connectionListeners.delete(listener);
  };
};

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
    hardDeactivateClient();
  }

  stompClient = buildStompClient(token);
  stompClient.activate();
  return stompClient;
};

/**
 * Reference-counted acquire for React StrictMode / nested mounts.
 * Returns a release function; connection closes only when all holders release.
 */
export const acquireWebSocketConnection = () => {
  connectionRefCount += 1;
  connectWebSocket();
  return () => {
    connectionRefCount = Math.max(0, connectionRefCount - 1);
    if (connectionRefCount === 0) {
      disconnectWebSocket();
    }
  };
};

export const waitForWebSocketConnection = (timeoutMs = 15000) => {
  connectWebSocket();
  if (isStompConnected()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(new Error('WebSocket is not connected'));
    }, timeoutMs);

    const unsubscribe = subscribeToConnectionChange((connected) => {
      if (!connected) return;
      window.clearTimeout(timeoutId);
      unsubscribe();
      resolve(true);
    });
  });
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

  if (handlers.onMessage) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/messages`, (frame) => {
        try {
          const event = JSON.parse(frame.body);
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
          const payload =
            event.type === 'MESSAGE_SENT' && event.message != null
              ? event.message
              : event;
          handlers.onMessage(payload);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      }),
    );
  }

  if (handlers.onTyping) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/typing`, (frame) => {
        try {
          handlers.onTyping(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse typing event:', error);
        }
      }),
    );
  }

  if (handlers.onRead) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/read`, (frame) => {
        try {
          handlers.onRead(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse read receipt:', error);
        }
      }),
    );
  }

  if (handlers.onPresence) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/presence`, (frame) => {
        try {
          handlers.onPresence(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse presence event:', error);
        }
      }),
    );
  }

  if (handlers.onMessageDeleted) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/deleted`, (frame) => {
        try {
          handlers.onMessageDeleted(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse delete event:', error);
        }
      }),
    );
  }

  if (handlers.onMessageEdited) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/edited`, (frame) => {
        try {
          handlers.onMessageEdited(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse edit event:', error);
        }
      }),
    );
  }

  if (handlers.onMessageReactionUpdated) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/reactions`, (frame) => {
        try {
          handlers.onMessageReactionUpdated(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse reaction event:', error);
        }
      }),
    );
  }

  if (handlers.onAttachment) {
    subs.push(
      stompClient.subscribe(`/topic/chat/${chatId}/attachment`, (frame) => {
        try {
          handlers.onAttachment(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse attachment event:', error);
        }
      }),
    );
  }

  subscription._subscriptions = subs;
};

export const subscribeToChat = (chatId, handlers) => {
  const subscription = { chatId, handlers, _subscriptions: [] };
  pendingChatSubscriptions.push(subscription);

  if (isStompConnected()) {
    attachChatSubscriptions(subscription);
  }

  return () => {
    pendingChatSubscriptions = pendingChatSubscriptions.filter((sub) => sub !== subscription);

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
  connectionRefCount = 0;

  pendingChatSubscriptions.forEach((sub) => {
    if (sub._subscriptions) {
      sub._subscriptions.forEach((s) => {
        try {
          s.unsubscribe();
        } catch (e) {
          console.debug('Unsubscribe during disconnect:', e);
        }
      });
    }
  });
  userEventSubscriptions.forEach((sub) => {
    try {
      sub.unsubscribe();
    } catch (error) {
      console.debug('Error unsubscribing user event stream:', error);
    }
  });

  hardDeactivateClient();
  userEventSubscriptions = [];
  pendingUserEventHandlers = [];
  pendingChatSubscriptions = [];
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
          console.error('Failed to parse chat created event:', error);
        }
      }),
    );
  }
  if (onChatUpdated) {
    subscriptions.push(
      stompClient.subscribe(`/user/queue/chats/updated`, (frame) => {
        try {
          onChatUpdated(JSON.parse(frame.body));
        } catch (error) {
          console.error('Failed to parse chat updated event:', error);
        }
      }),
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
          console.error('Failed to parse room member invite event:', error);
        }
      }),
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
        console.debug('Error unsubscribing user event handler:', error);
      }
    });
    userEventSubscriptions = userEventSubscriptions.filter((sub) => !subscriptions.includes(sub));
    pendingUserEventHandlers = pendingUserEventHandlers.filter((item) => item !== handlers);
  };
};

export const sendMessage = (destination, payload) => {
  if (isStompConnected()) {
    stompClient.publish({
      destination: `/app/${destination}`,
      body: JSON.stringify(payload),
    });
    return true;
  }
  return false;
};

export const sendChatMessage = (payload) => {
  if (!isStompConnected()) {
    return false;
  }

  const message = {
    chatId: payload.chatId,
    content: payload.content || null,
    attachmentIds: payload.attachmentIds || [],
    type: payload.type || 'TEXT',
    replyToMessageId: payload.replyToMessageId || null,
  };

  stompClient.publish({
    destination: '/app/chat.send',
    body: JSON.stringify(message),
  });

  return true;
};

export const ensureSendChatMessage = async (payload) => {
  await waitForWebSocketConnection();
  const sent = sendChatMessage(payload);
  if (!sent) {
    throw new Error('WebSocket is not connected');
  }
  return true;
};

export const sendForwardMessage = ({ chatId, forwardSourceMessageId }) => {
  if (!isStompConnected()) {
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
    replyToMessageId: null,
  };
  stompClient.publish({
    destination: '/app/chat.send',
    body: JSON.stringify(body),
  });
  return true;
};

export const ensureSendForwardMessage = async (payload) => {
  await waitForWebSocketConnection();
  const sent = sendForwardMessage(payload);
  if (!sent) {
    throw new Error('WebSocket is not connected');
  }
  return true;
};

export const sendTypingEvent = (payload) => {
  if (!isStompConnected()) {
    return false;
  }
  return sendMessage('chat.typing', {
    chatId: payload.chatId,
    typing: payload.typing,
  });
};

export default {
  connectWebSocket,
  acquireWebSocketConnection,
  disconnectWebSocket,
  waitForWebSocketConnection,
  subscribeToConnectionChange,
  isWebSocketConnected,
  sendMessage,
  sendChatMessage,
  ensureSendChatMessage,
  sendForwardMessage,
  ensureSendForwardMessage,
  sendTypingEvent,
  subscribeToChat,
  subscribeToUserChatEvents,
};
