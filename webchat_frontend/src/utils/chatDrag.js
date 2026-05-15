export const CHAT_DRAG_TYPE = 'application/x-webchat-chat-id';

export const isChatDragEvent = (event) => {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes(CHAT_DRAG_TYPE) || Array.from(types).includes('text/plain');
};

export const readChatDragId = (event) => {
  try {
    return event.dataTransfer.getData(CHAT_DRAG_TYPE) || event.dataTransfer.getData('text/plain');
  } catch {
    return '';
  }
};
