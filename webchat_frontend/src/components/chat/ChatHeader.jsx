import React, { useState } from 'react';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ExitToAppOutlinedIcon from '@mui/icons-material/ExitToAppOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { getPresenceLabel } from '../../utils/presence';
import { chatColors } from '../../theme/chatDesignTokens';

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
  canDeleteRoom = false,
  onRequestLeaveRoom,
  onRequestDeleteRoom,
  inChatSearchOpen = false,
  onToggleInChatSearch,
  showGroupInfoToggle = false,
  groupInfoPanelOpen = false,
  onToggleGroupInfoPanel,
  showMembersPanelToggle = false,
  membersPanelOpen = false,
  onToggleMembersPanel,
  groupInfoToggleLabel = 'Group info',
}) => {
  const [menuAnchor, setMenuAnchor] = useState(null);

  const derivedTitle = otherUser
    ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() ||
      otherUser.username
    : 'Chat';

  const title = headerTitle ?? derivedTitle;

  const avatarSrc = headerAvatarSrc ?? undefined;
  const letter = headerAvatarLetter ?? getUserAvatarLetter(otherUser);
  const subtitle = isTyping
    ? getPresenceLabel(presenceStatus, true)
    : headerSubtitle ?? getPresenceLabel(presenceStatus, false);

  const avatarTooltip = headerTitle
    ? 'View room details'
    : otherUser
      ? 'View profile'
      : 'View details';

  const handleAvatarClick = () => {
    if (!avatarInteractive) return;
    onOpenProfile?.();
  };

  const handleCopyInvite = async () => {
    setMenuAnchor(null);
    await onCopyInvite?.();
  };

  const closeMenu = () => setMenuAnchor(null);

  const avatarInteractive = Boolean(headerAvatarClickable && onOpenProfile);

  const hasRoomMenuItems = showCopyInvite || canLeaveRoom || canDeleteRoom;

  const avatarEl = (
    <UserAvatar
      user={otherUser}
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

  const headerActions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
      {showGroupInfoToggle && onToggleGroupInfoPanel ? (
        <Tooltip title={groupInfoPanelOpen ? `Hide ${groupInfoToggleLabel}` : `Show ${groupInfoToggleLabel}`}>
          <IconButton
            aria-label={groupInfoPanelOpen ? `Hide ${groupInfoToggleLabel}` : `Show ${groupInfoToggleLabel}`}
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
        <Tooltip title={membersPanelOpen ? 'Hide members' : 'Show members'}>
          <IconButton
            aria-label={membersPanelOpen ? 'Hide members panel' : 'Show members panel'}
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
      {onToggleInChatSearch ? (
        <Tooltip title={inChatSearchOpen ? 'Close search' : 'Search in chat'}>
          <IconButton
            aria-label="Search in chat"
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
      {isGroupOrChannel && hasRoomMenuItems ? (
        <>
          <Tooltip title="Room options">
            <IconButton
              aria-label="Room options"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              size="small"
              sx={headerIconButtonSx}
            >
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={closeMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { minWidth: 220 } } }}
          >
            {showCopyInvite ? (
              <MenuItem onClick={handleCopyInvite}>
                <ListItemIcon>
                  <LinkIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Copy invite link" />
              </MenuItem>
            ) : null}
            {canLeaveRoom ? (
              <MenuItem
                onClick={() => {
                  closeMenu();
                  onRequestLeaveRoom?.();
                }}
              >
                <ListItemIcon>
                  <ExitToAppOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Leave group/channel" />
              </MenuItem>
            ) : null}
            {canDeleteRoom ? (
              <MenuItem
                onClick={() => {
                  closeMenu();
                  onRequestDeleteRoom?.();
                }}
                sx={{ color: 'error.main' }}
              >
                <ListItemIcon>
                  <DeleteOutlineIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText primary="Delete group/channel" />
              </MenuItem>
            ) : null}
          </Menu>
        </>
      ) : null}
      {!emojiSidebarOpen && onShowEmojiSidebar ? (
        <Tooltip title="Show emoji sidebar">
          <IconButton
            size="small"
            onClick={onShowEmojiSidebar}
            sx={headerIconButtonSx}
          >
            <EmojiEmotionsOutlinedIcon />
          </IconButton>
        </Tooltip>
      ) : null}
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
