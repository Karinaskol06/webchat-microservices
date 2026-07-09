import React, { useState } from 'react';
import {
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { derivePresenceState } from '../../utils/presence';
import { isDeletedAccountUser } from '../../utils/chatDisplay';
import { chatColors, chatMenuSlotProps } from '../../theme/chatDesignTokens';
import useTranslation from '../../hooks/useTranslation';

import UserAvatar from '../user/UserAvatar';
import { getUserAvatarLetter } from '../../utils/userAvatar';

const ChatHeader = ({
  otherUser,
  presenceStatus,
  isTyping,
  emojiSidebarOpen,
  onOpenProfile,
  onShowEmojiSidebar,
  /** When set, overrides title/avatar derived from `otherUser` (e.g. group / channel). */
  headerTitle,
  headerSubtitle,
  headerAvatarSrc,
  headerAvatarCacheKey,
  headerAvatarLetter,
  /** If false, avatar is not clickable (rooms). */
  headerAvatarClickable = true,
  showCopyInvite = false,
  onCopyInvite,
  isGroupOrChannel = false,
  canLeaveRoom = false,
  onRequestLeaveRoom,
  canDeleteChat = false,
  onRequestDeleteChat,
  inChatSearchOpen = false,
  onToggleInChatSearch,
  showGroupInfoToggle = false,
  groupInfoPanelOpen = false,
  onToggleGroupInfoPanel,
  showMembersPanelToggle = false,
  membersPanelOpen = false,
  onToggleMembersPanel,
  groupInfoToggleLabel,
}) => {
  const { t } = useTranslation();
  const [roomMenuAnchor, setRoomMenuAnchor] = useState(null);
  const panelToggleLabel = groupInfoToggleLabel ?? t('chat.sidebar.groupInfo');

  const derivedTitle = isDeletedAccountUser(otherUser)
    ? t('common.deletedAccount')
    : otherUser
      ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() ||
        otherUser.username
      : t('roomType.fallback');

  const title = headerTitle ?? derivedTitle;

  const avatarSrc = headerAvatarSrc ?? undefined;
  const letter = headerAvatarLetter ?? getUserAvatarLetter(otherUser);
  const getPresenceSubtitle = () => {
    if (isTyping) return t('chatHeader.presence.typing');
    if (headerSubtitle != null) return headerSubtitle;
    const state = derivePresenceState(presenceStatus);
    if (state === 'online') return t('chatHeader.presence.online');
    return presenceStatus?.lastSeenFormatted || t('chatHeader.presence.lastSeen');
  };
  const subtitle = getPresenceSubtitle();

  const avatarTooltip = headerTitle
    ? t('chatHeader.avatar.viewRoomDetails')
    : otherUser
      ? t('chatHeader.avatar.viewProfile')
      : t('chatHeader.avatar.viewDetails');

  const handleAvatarClick = () => {
    if (!avatarInteractive) return;
    onOpenProfile?.();
  };

  const avatarInteractive = Boolean(headerAvatarClickable && onOpenProfile);

  const avatarEl = (
    <UserAvatar
      user={isGroupOrChannel || headerAvatarLetter != null ? null : otherUser}
      src={avatarSrc}
      cacheKey={headerAvatarCacheKey}
      letter={letter}
      variant="rounded"
      onClick={handleAvatarClick}
      sx={{
        mr: 1.5,
        width: 48,
        height: 48,
        cursor: avatarInteractive ? 'pointer' : 'default',
        flexShrink: 0,
      }}
    />
  );

  const headerIconButtonSx = {
    flexShrink: 0,
    color: chatColors.textPrimary,
  };

  const closeRoomMenu = () => setRoomMenuAnchor(null);

  const showRoomOverflowMenu =
    isGroupOrChannel &&
    (onToggleInChatSearch ||
      (!emojiSidebarOpen && onShowEmojiSidebar) ||
      canLeaveRoom ||
      canDeleteChat);

  const roomMenuItems = [];

  if (onToggleInChatSearch) {
    roomMenuItems.push({
      key: 'search',
      label: inChatSearchOpen ? t('chatHeader.search.close') : t('chatHeader.search.open'),
      icon: SearchIcon,
      selected: inChatSearchOpen,
      onClick: () => {
        closeRoomMenu();
        onToggleInChatSearch();
      },
    });
  }

  if (!emojiSidebarOpen && onShowEmojiSidebar) {
    roomMenuItems.push({
      key: 'emoji',
      label: t('chatHeader.emoji.show'),
      icon: EmojiEmotionsOutlinedIcon,
      onClick: () => {
        closeRoomMenu();
        onShowEmojiSidebar();
      },
    });
  }

  if (canLeaveRoom) {
    roomMenuItems.push({
      key: 'leave',
      label: t('chatHeader.menu.leave'),
      icon: LogoutIcon,
      onClick: () => {
        closeRoomMenu();
        onRequestLeaveRoom?.();
      },
    });
  }

  const destructiveMenuStartIndex = roomMenuItems.length;

  if (canDeleteChat) {
    roomMenuItems.push({
      key: 'delete',
      label: t('chatHeader.menu.delete'),
      icon: DeleteOutlineIcon,
      destructive: true,
      onClick: () => {
        closeRoomMenu();
        onRequestDeleteChat?.();
      },
    });
  }

  const headerActions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
      {showGroupInfoToggle && onToggleGroupInfoPanel ? (
        <Tooltip title={groupInfoPanelOpen ? t('chatHeader.panel.hide', { label: panelToggleLabel }) : t('chatHeader.panel.show', { label: panelToggleLabel })}>
          <IconButton
            aria-label={groupInfoPanelOpen ? t('chatHeader.panel.hide', { label: panelToggleLabel }) : t('chatHeader.panel.show', { label: panelToggleLabel })}
            aria-pressed={groupInfoPanelOpen}
            size="small"
            onClick={onToggleGroupInfoPanel}
            sx={{
              ...headerIconButtonSx,
              color: groupInfoPanelOpen ? chatColors.primary : chatColors.textPrimary,
            }}
          >
            <CollectionsOutlinedIcon />
          </IconButton>
        </Tooltip>
      ) : null}
      {showMembersPanelToggle && onToggleMembersPanel ? (
        <Tooltip title={membersPanelOpen ? t('chatHeader.members.hide') : t('chatHeader.members.show')}>
          <IconButton
            aria-label={membersPanelOpen ? t('chatHeader.members.ariaHide') : t('chatHeader.members.ariaShow')}
            aria-pressed={membersPanelOpen}
            size="small"
            onClick={onToggleMembersPanel}
            sx={{
              ...headerIconButtonSx,
              color: membersPanelOpen ? chatColors.primary : chatColors.textPrimary,
            }}
          >
            <GroupsOutlinedIcon />
          </IconButton>
        </Tooltip>
      ) : null}
      {showCopyInvite ? (
        <Tooltip title={t('chatHeader.menu.copyInvite')}>
          <IconButton
            aria-label={t('chatHeader.menu.copyInvite')}
            onClick={onCopyInvite}
            size="small"
            sx={headerIconButtonSx}
          >
            <LinkIcon />
          </IconButton>
        </Tooltip>
      ) : null}

      {isGroupOrChannel ? (
        showRoomOverflowMenu ? (
          <>
            <Tooltip title={t('chatHeader.menu.roomOptions')}>
              <IconButton
                aria-label={t('chatHeader.menu.roomOptions')}
                aria-haspopup="menu"
                aria-expanded={Boolean(roomMenuAnchor)}
                size="small"
                onClick={(event) => setRoomMenuAnchor(event.currentTarget)}
                sx={headerIconButtonSx}
              >
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={roomMenuAnchor}
              open={Boolean(roomMenuAnchor)}
              onClose={closeRoomMenu}
              slotProps={chatMenuSlotProps}
              disableAutoFocusItem
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {roomMenuItems.flatMap((item, index) => {
                const Icon = item.icon;
                const showDivider =
                  item.destructive && index === destructiveMenuStartIndex && destructiveMenuStartIndex > 0;

                const elements = [];
                if (showDivider) {
                  elements.push(
                    <Divider
                      key={`${item.key}-divider`}
                      sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.12)' }}
                    />,
                  );
                }
                elements.push(
                  <MenuItem
                    key={item.key}
                    onClick={item.onClick}
                    selected={item.selected}
                    sx={
                      item.destructive
                        ? {
                            color: '#ffb4ab',
                            '& .MuiListItemIcon-root': { color: '#ffb4ab' },
                          }
                        : undefined
                    }
                  >
                    <ListItemIcon>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    {item.label}
                  </MenuItem>,
                );
                return elements;
              })}
            </Menu>
          </>
        ) : null
      ) : (
        <>
          {onToggleInChatSearch ? (
            <Tooltip title={inChatSearchOpen ? t('chatHeader.search.close') : t('chatHeader.search.open')}>
              <IconButton
                aria-label={t('chatHeader.search.open')}
                aria-pressed={inChatSearchOpen}
                size="small"
                onClick={onToggleInChatSearch}
                sx={{
                  ...headerIconButtonSx,
                  color: inChatSearchOpen ? chatColors.primary : chatColors.textPrimary,
                }}
              >
                <SearchIcon />
              </IconButton>
            </Tooltip>
          ) : null}
          {canDeleteChat ? (
            <Tooltip title={t('chatHeader.delete.tooltip')}>
              <IconButton
                aria-label={t('chatHeader.menu.deleteChat')}
                onClick={onRequestDeleteChat}
                size="small"
                sx={{
                  ...headerIconButtonSx,
                  color: chatColors.textSecondary,
                  '&:hover': {
                    color: '#fff',
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                  },
                }}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Tooltip>
          ) : null}
          {!emojiSidebarOpen && onShowEmojiSidebar ? (
            <Tooltip title={t('chatHeader.emoji.show')}>
              <IconButton
                size="small"
                onClick={onShowEmojiSidebar}
                sx={headerIconButtonSx}
              >
                <EmojiEmotionsOutlinedIcon />
              </IconButton>
            </Tooltip>
          ) : null}
        </>
      )}
    </Box>
  );

  return (
    <Box display="flex" alignItems="center" gap={1} minWidth={0}>
      {avatarInteractive ? <Tooltip title={avatarTooltip}>{avatarEl}</Tooltip> : avatarEl}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="h6"
          noWrap
          sx={{ fontWeight: 700, lineHeight: 1.25, color: chatColors.textPrimary }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          noWrap
          display="block"
          sx={{ color: chatColors.textSecondary }}
        >
          {subtitle}
        </Typography>
      </Box>

      {headerActions}
    </Box>
  );
};

export default ChatHeader;
