import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let stompClient = null;
let pendingChatSubscriptions = [];

export const connectWebSocket = () => {
  const token = localStorage.getItem('token');
  
  // Create SockJS connection directly to chat-service (bypass gateway for WebSocket)
  const socket = new SockJS('http://localhost:8083/ws/chat', null, {
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
    return;
  }

  const { chatId, handlers } = subscription;
  const subs = [];

  if (handlers.onMessage) {
    subs.push(
      stompClient.subscribe(`/topic/chat.${chatId}.messages`, (frame) => {
        const event = JSON.parse(frame.body);
        handlers.onMessage(event);
      })
    );
  }

  if (handlers.onTyping) {
    subs.push(
      stompClient.subscribe(`/topic/chat.${chatId}.typing`, (frame) => {
        const event = JSON.parse(frame.body);
        handlers.onTyping(event);
      })
    );
  }

  if (handlers.onRead) {
    subs.push(
      stompClient.subscribe(`/topic/chat.${chatId}.read`, (frame) => {
        const event = JSON.parse(frame.body);
        handlers.onRead(event);
      })
    );
  }

  subscription._subscriptions = subs;
};

export const subscribeToChat = (chatId, handlers) => {
  const subscription = { chatId, handlers, _subscriptions: [] };
  pendingChatSubscriptions.push(subscription);

  if (stompClient && stompClient.connected) {
    attachChatSubscriptions(subscription);
  }

  return () => {
    pendingChatSubscriptions = pendingChatSubscriptions.filter(
      (sub) => sub !== subscription
    );

    if (subscription._subscriptions) {
      subscription._subscriptions.forEach((sub) => sub.unsubscribe());
    }
  };
};

export const disconnectWebSocket = () => {
  if (stompClient) {
    stompClient.deactivate();
    stompClient = null;
    pendingChatSubscriptions = [];
  }
};

export const sendMessage = (destination, payload) => {
  if (stompClient && stompClient.connected) {
    stompClient.publish({
      destination: `/app/${destination}`,
      body: JSON.stringify(payload)
    });
  }
};

export default {
  connectWebSocket,
  disconnectWebSocket,
  sendMessage,
  subscribeToChat
};