import React, { useEffect, useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatNavRail from './ChatNavRail';
import useAuthStore from '../../store/useAuthStore';
import useChatFolderStore from '../../store/useChatFolderStore';
import {
  chatColors,
  chatConversationPanelSx,
  chatGlassListSx,
  chatGlassNavSx,
  chatLayout,
  chatShellBgLayerSx,
  chatShellRootSx,
} from '../../theme/chatDesignTokens';
import { chatBgSettleSx, chatPanelEnterSx } from '../../theme/chatAnimations';

/**
 * Glass bento chat workspace: login background + frosted nav/list + dark conversation.
 */
const ChatShell = ({
  listPanel,
  mainPanel,
  infoPanel,
  showInfoPanel,
  hasActiveChat,
  onBackFromChat,
  onOpenProfile,
  onOpenSettings,
  settingsOpen,
  onFindUsers,
  findUsersOpen,
  pendingRoomInviteCount = 0,
  onFolderViewChange,
  personalSpaceActive,
  onPersonalSpaceSelect,
  onExitPersonalSpaceMode,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isCompact = useMediaQuery(theme.breakpoints.down('lg'));
  const [chatFilter, setChatFilter] = useState('ALL');
  const user = useAuthStore((s) => s.user);
  const activeFolderId = useChatFolderStore((s) => s.activeFolderId);
  const initFoldersForUser = useChatFolderStore((s) => s.initForUser);
  const setActiveFolderId = useChatFolderStore((s) => s.setActiveFolderId);

  useEffect(() => {
    if (user?.id) initFoldersForUser(user.id);
    else useChatFolderStore.getState().clearForUser();
  }, [user?.id, initFoldersForUser]);

  const showListOnMobile = isMobile && !hasActiveChat;
  const showMainOnMobile = isMobile && hasActiveChat;

  const panelMotion = (delay) => chatPanelEnterSx(delay);

  return (
    <Box sx={chatShellRootSx}>
      <Box aria-hidden sx={{ ...chatShellBgLayerSx, ...chatBgSettleSx }} />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          flexShrink: 0,
          display: { xs: 'none', md: 'flex' },
          alignSelf: 'stretch',
          ...chatGlassNavSx,
          width: chatLayout.navRailWidth + 8,
          py: 0.5,
          ...panelMotion(0),
        }}
      >
        <ChatNavRail
          activeFilter={chatFilter}
          activeFolderId={activeFolderId}
          onFilterChange={(filter) => {
            if (personalSpaceActive) {
              onExitPersonalSpaceMode?.();
              setActiveFolderId(null);
            }
            setChatFilter(filter);
          }}
          onFolderSelect={(folderId) => {
            if (personalSpaceActive) onExitPersonalSpaceMode?.();
            setActiveFolderId(folderId);
            setChatFilter('ALL');
            onFolderViewChange?.();
          }}
          onAllChatsSelect={() => {
            if (personalSpaceActive) onExitPersonalSpaceMode?.();
            setActiveFolderId(null);
          }}
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          settingsOpen={settingsOpen}
          onFindUsers={onFindUsers}
          findUsersOpen={findUsersOpen}
          pendingRoomInviteCount={pendingRoomInviteCount}
          personalSpaceActive={personalSpaceActive}
          onPersonalSpaceSelect={onPersonalSpaceSelect}
        />
      </Box>

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          gap: `${chatLayout.gap}px`,
        }}
      >
        {(!isMobile || showListOnMobile) && (
          <Box
            sx={{
              ...chatGlassListSx,
              width: isMobile ? '100%' : chatLayout.listWidth,
              maxWidth: isMobile ? '100%' : 400,
              flexShrink: 0,
              display: showMainOnMobile ? 'none' : 'flex',
              ...panelMotion(0.06),
            }}
          >
            {typeof listPanel === 'function'
              ? listPanel({ chatFilter, activeFolderId })
              : listPanel}
          </Box>
        )}

        {(!isMobile || showMainOnMobile) && (
          <Box
            sx={{
              ...chatConversationPanelSx,
              flex: 1,
              minWidth: 0,
              display: !isMobile || showMainOnMobile ? 'flex' : 'none',
              ...panelMotion(0.12),
            }}
          >
            {isMobile && hasActiveChat && (
              <Box
                sx={{
                  flexShrink: 0,
                  px: 1,
                  py: 0.75,
                  borderBottom: `1px solid ${chatColors.borderSubtle}`,
                  bgcolor: chatColors.conversationBg,
                }}
              >
                <IconButton
                  aria-label="Back to chats"
                  onClick={onBackFromChat}
                  size="small"
                  sx={{ color: chatColors.textPrimary }}
                >
                  <ArrowBackIcon />
                </IconButton>
              </Box>
            )}
            {mainPanel}
          </Box>
        )}

        {showInfoPanel && !isCompact && infoPanel ? (
          <Box
            sx={{
              flexShrink: 0,
              minHeight: 0,
              alignSelf: 'stretch',
              display: 'flex',
              minWidth: 0,
            }}
          >
            {infoPanel}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};

export default ChatShell;
