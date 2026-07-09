import { getMessageId } from './notificationDedup';

/** Normalize MESSAGE_SENT / INCOMING_CHAT_MESSAGE / raw DTO shapes from STOMP. */
export const extractWsChatMessagePayload = (event) => {
  if (!event || typeof event !== 'object') return null;

  const type = String(event.type ?? '').toUpperCase();
  if (type === 'INCOMING_CHAT_MESSAGE' && event.message) {
    return event.message;
  }
  if (type === 'MESSAGE_SENT' && event.message) {
    return event.message;
  }
  if (getMessageId(event)) {
    return event;
  }
  return null;
};
