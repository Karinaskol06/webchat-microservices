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
import ViewSidebarOutlinedIcon from '@mui/icons-material/ViewSidebarOutlined';
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
  roomInfoPanelOpen = true,
  onToggleRoomInfoPanel,
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
        {isGroupOrChannel && onToggleRoomInfoPanel ? (
          <Tooltip title={roomInfoPanelOpen ? 'Hide room panel' : 'Show room panel'}>
            <IconButton
              aria-label={roomInfoPanelOpen ? 'Hide room panel' : 'Show room panel'}
              aria-pressed={roomInfoPanelOpen ? 'true' : 'false'}
              size="small"
              onClick={onToggleRoomInfoPanel}
              sx={{ color: roomInfoPanelOpen ? chatColors.primary : chatColors.textPrimary }}
            >
              <ViewSidebarOutlinedIcon fontSize="small" />
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
              sx={{ color: inChatSearchOpen ? chatColors.primary : chatColors.textPrimary }}
            >
              <SearchIcon />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>

      {isGroupOrChannel && hasRoomMenuItems ? (
        <>
          <Tooltip title="Room options">
            <IconButton
              aria-label="Room options"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              size="small"
              sx={{ flexShrink: 0, color: chatColors.textPrimary }}
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

      {!emojiSidebarOpen && (
        <Box sx={{ ml: 'auto', flexShrink: 0 }}>
          <Tooltip title="Show emoji sidebar">
            <IconButton onClick={onShowEmojiSidebar} sx={{ color: chatColors.textPrimary }}>
              <EmojiEmotionsOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default ChatHeader;
