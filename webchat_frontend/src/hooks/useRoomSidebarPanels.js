import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDefaultRoomSidebarPanelPrefs,
  readRoomSidebarPanelPrefs,
  writeRoomSidebarPanelPrefs,
} from '../utils/roomSidebarPanelPrefs';

const useRoomSidebarPanels = (currentChat) => {
  const chatId = currentChat?.id ?? null;
  const [groupInfoPanelOpen, setGroupInfoPanelOpen] = useState(false);
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);
  const [groupInfoFolded, setGroupInfoFolded] = useState(false);
  const [membersFolded, setMembersFolded] = useState(false);
  const hydratedChatIdRef = useRef(null);

  const stateRef = useRef({
    groupInfoOpen: false,
    membersOpen: false,
    groupInfoFolded: false,
    membersFolded: false,
  });

  const applyState = useCallback((next) => {
    stateRef.current = next;
    setGroupInfoPanelOpen(next.groupInfoOpen);
    setMembersPanelOpen(next.membersOpen);
    setGroupInfoFolded(next.groupInfoFolded);
    setMembersFolded(next.membersFolded);
  }, []);

  const commitPanelPrefs = useCallback(
    (patch) => {
      const next = { ...stateRef.current, ...patch };
      applyState(next);
      if (chatId != null && chatId !== '') {
        writeRoomSidebarPanelPrefs(chatId, next);
      }
    },
    [applyState, chatId],
  );

  useEffect(() => {
    const id = chatId != null && chatId !== '' ? String(chatId) : null;

    if (!id) {
      hydratedChatIdRef.current = null;
      applyState({
        groupInfoOpen: false,
        membersOpen: false,
        groupInfoFolded: false,
        membersFolded: false,
      });
      return;
    }

    if (hydratedChatIdRef.current === id) return;

    const stored = readRoomSidebarPanelPrefs(id);
    const next = stored ?? getDefaultRoomSidebarPanelPrefs(currentChat);
    hydratedChatIdRef.current = id;
    applyState(next);
    if (!stored) {
      writeRoomSidebarPanelPrefs(id, next);
    }
  }, [chatId, currentChat, applyState]);

  const toggleGroupInfoPanel = useCallback(() => {
    if (stateRef.current.groupInfoOpen) {
      commitPanelPrefs({ groupInfoOpen: false });
      return;
    }
    commitPanelPrefs({ groupInfoOpen: true, groupInfoFolded: false });
  }, [commitPanelPrefs]);

  const toggleMembersPanel = useCallback(() => {
    if (stateRef.current.membersOpen) {
      commitPanelPrefs({ membersOpen: false });
      return;
    }
    commitPanelPrefs({ membersOpen: true, membersFolded: false });
  }, [commitPanelPrefs]);

  const closeGroupInfoPanel = useCallback(() => {
    commitPanelPrefs({ groupInfoOpen: false });
  }, [commitPanelPrefs]);

  const closeMembersPanel = useCallback(() => {
    commitPanelPrefs({ membersOpen: false });
  }, [commitPanelPrefs]);

  const toggleGroupInfoFold = useCallback(() => {
    commitPanelPrefs({ groupInfoFolded: !stateRef.current.groupInfoFolded });
  }, [commitPanelPrefs]);

  const toggleMembersFold = useCallback(() => {
    commitPanelPrefs({ membersFolded: !stateRef.current.membersFolded });
  }, [commitPanelPrefs]);

  return {
    groupInfoPanelOpen,
    membersPanelOpen,
    groupInfoFolded,
    membersFolded,
    toggleGroupInfoPanel,
    toggleMembersPanel,
    closeGroupInfoPanel,
    closeMembersPanel,
    toggleGroupInfoFold,
    toggleMembersFold,
  };
};

export default useRoomSidebarPanels;
