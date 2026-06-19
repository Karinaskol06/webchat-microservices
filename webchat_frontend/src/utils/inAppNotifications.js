import { getMessagePreviewText } from './personalSpace';
import { buildNotificationIdempotencyKey, getMessageId } from './notificationDedup';

const FALLBACK_ICON = '/avatar-stub.svg';

const resolveIconUrl = (message) => {
  const raw =
    message?.sender?.profilePicture ??
    message?.sender?.avatar ??
    message?.senderProfilePicture ??
    null;
  if (!raw || typeof raw !== 'string') {
    return new URL(FALLBACK_ICON, window.location.origin).href;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return new URL(FALLBACK_ICON, window.location.origin).href;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return new URL(path, window.location.origin).href;
};

const senderLabel = (message) => {
  const sender = message?.sender;
  if (sender) {
    const full = [sender.firstName, sender.lastName].filter(Boolean).join(' ').trim();
    if (full) return full;
    if (sender.username) return sender.username;
  }
  if (message?.senderName) return message.senderName;
  return 'New message';
};

const postNotificationToServiceWorker = async (payload) => {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active ?? navigator.serviceWorker.controller;
  if (!worker) return false;
  worker.postMessage(payload);
  return true;
};

/**
 * Request a notification via the service worker (single idempotent renderer).
 */
export const showChatMessageNotification = async ({ message, chatId, chatTitle }) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  if (!message || typeof message !== 'object') return;

  const messageId = getMessageId(message);
  const idempotencyKey = buildNotificationIdempotencyKey(message, chatId);
  const body = getMessagePreviewText(message) || chatTitle || 'You have a new message';
  const icon = resolveIconUrl(message);

  const notificationOptions = {
    body,
    icon,
    badge: icon,
    tag: idempotencyKey,
    data: {
      notificationType: 'message-created',
      chatId,
      messageId,
      idempotencyKey,
    },
  };

  const posted = await postNotificationToServiceWorker({
    type: 'SHOW_MESSAGE_NOTIFICATION',
    idempotencyKey,
    title: senderLabel(message),
    options: {
      ...notificationOptions,
      actions: [
        { action: 'mark-read', title: 'Mark as read' },
        { action: 'answer', title: 'Answer' },
      ],
    },
  });

  if (!posted) {
    console.warn('[notify] service worker not ready; skipping duplicate-prone native fallback');
  }
};

/** WebSocket path: visible tab only. Hidden/offline tabs rely on web push. */
export const shouldNotifyForIncomingMessage = ({ isIncoming, isFocused }) => {
  if (!isIncoming) return false;
  if (isFocused) return false;
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
};
