/* global clients */

// Force a freshly-installed service worker to skip the "waiting" phase.
// Without this, a NEW sw.js sits idle until every tab/window for the
// origin is closed — meaning the OLD service worker (which may not have
// a push handler at all) keeps receiving push events and silently
// dropping them. This is what causes "notifications work in incognito
// but not in the regular profile" type asymmetries.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// As soon as the new service worker activates, take control of every
// existing client (open tab/window) so the next push event is handled
// by THIS sw.js, not by the previous version still cached in the page.
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const FALLBACK_AVATAR_ICON_PATH = '/avatar-stub.svg';

const resolveAbsoluteNotificationIcon = (candidate) => {
  if (!candidate || typeof candidate !== 'string') return null;
  const t = candidate.trim();
  if (!t) return null;
  try {
    if (/^https?:\/\//i.test(t)) return t;
    const path = t.startsWith('/') ? t : `/${t}`;
    return new URL(path, self.location.origin).href;
  } catch {
    return null;
  }
};

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'New message', body: event.data.text() };
  }

  const notificationData = payload.data || {};
  const notificationType = notificationData.notificationType || 'message-created';
  const senderDisplayName =
    notificationData.senderDisplayName ||
    notificationData.reactorDisplayName ||
    notificationData.inviterDisplayName ||
    payload.title ||
    'New message';
  const avatarRaw =
    payload.icon ||
    notificationData.senderAvatarUrl ||
    notificationData.reactorAvatarUrl ||
    notificationData.inviterAvatarUrl ||
    notificationData.senderProfilePicture ||
    notificationData.profilePicture ||
    null;
  const avatarIcon =
    resolveAbsoluteNotificationIcon(avatarRaw) ||
    new URL(FALLBACK_AVATAR_ICON_PATH, self.location.origin).toString();
  const autoCloseMs = Number(notificationData.autoCloseMs) || 10000;
  const notificationTag =
    notificationType === 'room-member-invited'
      ? `invite-${notificationData.inviteId || notificationData.roomId || 'pending'}`
      : notificationData.chatId || 'chat-message';
  const options = {
    body: payload.body || 'You have a new message',
    icon: avatarIcon,
    badge: avatarIcon,
    data: notificationData,
    actions: payload.actions || [],
    tag: notificationTag,
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration
      .showNotification(payload.title || 'New message', options)
      .then(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              self.registration
                .getNotifications({ tag: notificationTag })
                .then((notifications) => {
                  notifications.forEach((notification) => notification.close());
                  resolve();
                })
                .catch(() => resolve());
            }, autoCloseMs);
          })
      )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const notificationType = data.notificationType || 'message-created';
  const chatId = data.chatId;
  const messageId = data.messageId;
  const inviteId = data.inviteId;
  const shouldMarkRead = event.action === 'mark-read';

  const targetUrl = new URL('/chat', self.location.origin);
  if (notificationType === 'room-member-invited') {
    if (inviteId) {
      targetUrl.searchParams.set('inviteId', inviteId);
    }
    if (data.roomId) {
      targetUrl.searchParams.set('roomId', data.roomId);
    }
    targetUrl.searchParams.set('view', 'invites');
  } else {
    if (chatId) {
      targetUrl.searchParams.set('chatId', chatId);
    }
    if (messageId) {
      targetUrl.searchParams.set('messageId', messageId);
    }
    if (shouldMarkRead && chatId) {
      targetUrl.searchParams.set('markRead', '1');
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const matchingClient = windowClients.find((client) => client.url.includes('/chat'));
      const client = matchingClient || windowClients[0];

      if (client) {
        if (shouldMarkRead && chatId) {
          client.postMessage({ type: 'MARK_CHAT_READ', chatId });
        }
        client.navigate(targetUrl.toString());
        return client.focus();
      }
      return clients.openWindow(targetUrl.toString());
    })
  );
});
