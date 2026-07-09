import { describe, expect, it } from 'vitest';
import {
  getDefaultRoomSidebarPanelPrefs,
  readRoomSidebarPanelPrefs,
  writeRoomSidebarPanelPrefs,
} from './roomSidebarPanelPrefs';

describe('roomSidebarPanelPrefs', () => {
  it('defaults group info open for groups and closed for private chats', () => {
    expect(getDefaultRoomSidebarPanelPrefs({ type: 'PRIVATE' }).groupInfoOpen).toBe(false);
    expect(getDefaultRoomSidebarPanelPrefs({ type: 'GROUP' }).groupInfoOpen).toBe(true);
  });

  it('defaults members panel only for groups and channel moderators', () => {
    expect(getDefaultRoomSidebarPanelPrefs({ type: 'GROUP' }).membersOpen).toBe(true);
    expect(
      getDefaultRoomSidebarPanelPrefs({
        type: 'CHANNEL',
        isCurrentUserChannelCreator: false,
        isCurrentUserChannelAdmin: false,
      }).membersOpen,
    ).toBe(false);
    expect(
      getDefaultRoomSidebarPanelPrefs({
        type: 'CHANNEL',
        isCurrentUserChannelAdmin: true,
      }).membersOpen,
    ).toBe(true);
  });

  it('persists and restores panel prefs per chat id', () => {
    writeRoomSidebarPanelPrefs('chat-1', {
      groupInfoOpen: false,
      membersOpen: false,
      groupInfoFolded: true,
      membersFolded: true,
    });

    expect(readRoomSidebarPanelPrefs('chat-1')).toEqual({
      groupInfoOpen: false,
      membersOpen: false,
      groupInfoFolded: true,
      membersFolded: true,
    });
    expect(readRoomSidebarPanelPrefs('chat-2')).toBeNull();
  });
});
