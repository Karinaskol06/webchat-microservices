/** Fired when server read state was updated (mark-as-read). Detail: { chatId } */
export const WEBCHAT_MESSAGES_MARKED_READ = 'webchat:messages-marked-read';

/** Incoming WS message appended while that chat is focused. Detail: { chatId, message } */
export const WEBCHAT_INCOMING_MESSAGE_OPEN_CHAT = 'webchat:incoming-message-open-chat';

/** Open a chat after forward completes. Detail: { chatId, message? } */
export const WEBCHAT_ACTIVATE_CHAT = 'webchat:activate-chat';

/** Chat removed for this user (delete-for-me or delete-for-everyone). Detail: { chatId } */
export const WEBCHAT_CHAT_DELETED = 'webchat:chat-deleted';

/** Chat created or first opened for this user. Detail: { chat } */
export const WEBCHAT_CHAT_CREATED = 'webchat:chat-created';

/** Fired when the current user adds/removes a contact (e.g. from profile). */
export const WEBCHAT_CONTACT_CHANGED = 'webchat:contact-changed';

/** Open chat from push/in-app notification. Detail: { chatId, messageId?, focusComposer?, markRead? } */
export const WEBCHAT_OPEN_CHAT_NOTIFICATION = 'webchat:open-chat-notification';
