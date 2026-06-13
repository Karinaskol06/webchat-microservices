export const ROOM_BANNED_CODE = 'ROOM_BANNED';

export function parseRoomBanError(error) {
  const body = typeof error === 'object' && error !== null ? error : null;
  if (!body) return null;
  if (body.code === ROOM_BANNED) {
    return {
      banned: true,
      message: body.message || body.error || 'You have been banned from this room.',
      roomName: body.roomName,
      roomType: body.roomType,
    };
  }
  return null;
}

export function roomBanLabel(roomType) {
  return String(roomType || '').toUpperCase() === 'CHANNEL' ? 'channel' : 'group';
}
