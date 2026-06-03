/** Display label for a chat in lists, forward picker, headers, etc. */

export const getChatTypeUpper = (chat) => String(chat?.type || '').toUpperCase();

export const isRoomLikeChat = (chat) => {
  const t = getChatTypeUpper(chat);
  return t === 'GROUP' || t === 'CHANNEL' || t === 'PERSONAL_SPACE';
};

export const getChatDisplayLabel = (chat) => {
  const t = getChatTypeUpper(chat);
  if (t === 'PERSONAL_SPACE') {
    return chat?.groupName || 'Personal Space';
  }
  if (t === 'CHANNEL') {
    return chat?.groupName || 'Channel';
  }
  if (t === 'GROUP') {
    return chat?.groupName || 'Group chat';
  }
  const u = chat?.otherUser;
  if (u?.firstName || u?.lastName) {
    return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  }
  return u?.username || 'Chat';
};

export const getChatDisplaySecondary = (chat) => {
  const t = getChatTypeUpper(chat);
  if (t === 'PERSONAL_SPACE') return 'Personal Space';
  if (t === 'CHANNEL') return 'Channel';
  if (t === 'GROUP') return 'Group';
  const username = chat?.otherUser?.username;
  return username ? `@${username}` : undefined;
};
