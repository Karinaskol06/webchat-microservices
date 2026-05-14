export function isChannelType(chat) {
  return String(chat?.type || '').toUpperCase() === 'CHANNEL';
}

/**
 * Non-channel chats use normal participant rules elsewhere.
 * In a channel, owner, promoted moderators, and granted posters may post (server enforces too).
 */
export function canPostInChannel(chat) {
  if (!chat || !isChannelType(chat)) return true;
  return Boolean(
    chat.isCurrentUserChannelCreator ||
      chat.isCurrentUserChannelAdmin ||
      chat.isCurrentUserChannelPoster,
  );
}

/** Group admins or channel owner / channel moderators may edit or delete others' messages. */
export function canModerateOthersMessages(chat, currentUserId) {
  if (!chat || currentUserId == null) return false;
  const t = String(chat.type || '').toUpperCase();
  if (t === 'PRIVATE') return false;
  if (t === 'GROUP') {
    return Boolean(chat.isCurrentUserAdmin);
  }
  if (t === 'CHANNEL') {
    return Boolean(chat.isCurrentUserChannelCreator || chat.isCurrentUserChannelAdmin);
  }
  return false;
}

export function channelPostingRestricted(chat) {
  return Boolean(chat && isChannelType(chat) && !canPostInChannel(chat));
}
