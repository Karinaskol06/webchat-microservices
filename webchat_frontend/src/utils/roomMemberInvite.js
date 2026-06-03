/** Copy for pending group/channel member invites (not tied to an open chat). */

export function getRoomInviteInviterName(invite) {
  const inviter = invite?.invitedBy;
  return (
    inviter?.username ||
    [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ') ||
    'Someone'
  );
}

export function getRoomInviteRoomLabel(invite) {
  if (invite?.roomName) return invite.roomName;
  return invite?.roomType === 'CHANNEL' ? 'Channel' : 'Group';
}

export function getRoomInviteRoomTypeLabel(invite) {
  return String(invite?.roomType || '').toUpperCase() === 'CHANNEL' ? 'Channel' : 'Group';
}

export function getRoomInviteDescription(invite) {
  const inviterName = getRoomInviteInviterName(invite);
  const roomLabel = getRoomInviteRoomLabel(invite);
  return `${inviterName} invited you to join ${roomLabel}`;
}
