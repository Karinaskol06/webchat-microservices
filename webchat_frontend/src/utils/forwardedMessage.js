export function forwardedSourceLabel(message) {
  const room = message?.forwardedFromRoom;
  if (room?.name) return room.name;
  const user = message?.forwardedFrom;
  return (
    user?.username ||
    user?.firstName ||
    (user?.id != null ? `User #${user.id}` : '')
  );
}

export function isForwardedFromRoom(message) {
  return Boolean(message?.forwardedFromRoom?.id);
}

export function isForwardedSourceClickable(message) {
  if (isForwardedFromRoom(message)) {
    return true;
  }
  return message?.forwardedFrom?.id != null;
}
