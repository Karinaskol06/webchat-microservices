import { canViewRoomMembers } from './channelPermissions';

const STORAGE_KEY = 'webchat:room-sidebar-panels';

function readAllPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getDefaultRoomSidebarPanelPrefs(chat) {
  const type = String(chat?.type || '').toUpperCase();
  const isPrivate = type === 'PRIVATE';
  const isPersonalSpace = type === 'PERSONAL_SPACE';
  const isGroupOrChannel = type === 'GROUP' || type === 'CHANNEL';

  return {
    groupInfoOpen: !isPrivate,
    membersOpen: isGroupOrChannel && !isPersonalSpace && canViewRoomMembers(chat),
    groupInfoFolded: false,
    membersFolded: false,
  };
}

export function readRoomSidebarPanelPrefs(chatId) {
  if (chatId == null || chatId === '') return null;
  const stored = readAllPrefs()[String(chatId)];
  if (!stored || typeof stored !== 'object') return null;

  return {
    groupInfoOpen: Boolean(stored.groupInfoOpen),
    membersOpen: Boolean(stored.membersOpen),
    groupInfoFolded: Boolean(stored.groupInfoFolded),
    membersFolded: Boolean(stored.membersFolded),
  };
}

export function writeRoomSidebarPanelPrefs(chatId, prefs) {
  if (chatId == null || chatId === '') return;
  const key = String(chatId);
  const all = readAllPrefs();
  all[key] = {
    groupInfoOpen: Boolean(prefs.groupInfoOpen),
    membersOpen: Boolean(prefs.membersOpen),
    groupInfoFolded: Boolean(prefs.groupInfoFolded),
    membersFolded: Boolean(prefs.membersFolded),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
