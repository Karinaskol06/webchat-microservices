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

export function isGroupOrChannelType(chat) {
  const t = String(chat?.type || '').toUpperCase();
  return t === 'GROUP' || t === 'CHANNEL';
}

/** Group creator/admins or channel owner/moderators may delete the room. */
/** Group admins or channel owner/moderators may edit name, description, and avatar. */
export function canEditRoomProfile(chat) {
  return canDeleteRoom(chat);
}

export function canDeleteRoom(chat) {
  if (!chat || !isGroupOrChannelType(chat)) return false;
  const t = String(chat.type || '').toUpperCase();
  if (t === 'GROUP') return Boolean(chat.isCurrentUserAdmin);
  if (t === 'CHANNEL') {
    return Boolean(chat.isCurrentUserChannelCreator || chat.isCurrentUserChannelAdmin);
  }
  return false;
}

export function canLeaveRoom(chat) {
  return isGroupOrChannelType(chat);
}

export function roomTypeLabel(chat) {
  const t = String(chat?.type || '').toUpperCase();
  if (t === 'CHANNEL') return 'Channel';
  if (t === 'GROUP') return 'Group chat';
  return 'Room';
}
