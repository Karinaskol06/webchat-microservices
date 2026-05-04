export const derivePresenceState = (presenceStatus) => {
  if (presenceStatus?.isOnlineInChat) return 'online';
  if (presenceStatus?.isAfk || presenceStatus?.isOnline) return 'afk';
  return 'offline';
};

export const getPresenceLabel = (presenceStatus, isTyping) => {
  if (isTyping) return 'Typing...';
  const state = derivePresenceState(presenceStatus);
  if (state === 'online') return 'Online';
  return presenceStatus?.lastSeenFormatted || 'Last seen recently';
};
