import React, { useState } from 'react';
import {
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LinkIcon from '@mui/icons-material/Link';
import { getPresenceLabel } from '../../utils/presence';

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
  showCopyInvite,
  onCopyInvite,
}) => {
  const [menuAnchor, setMenuAnchor] = useState(null);

  const derivedTitle = otherUser
    ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() ||
      otherUser.username
    : 'Chat';

  const title = headerTitle ?? derivedTitle;

  const avatarSrc = headerAvatarSrc ?? otherUser?.profilePicture ?? undefined;
  const letter =
    headerAvatarLetter ??
    (otherUser?.firstName?.[0] || otherUser?.username?.[0] || 'U').toUpperCase();

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

  const avatarInteractive = Boolean(headerAvatarClickable && onOpenProfile);

  const avatarEl = (
    <Avatar
      sx={{
        mr: 1,
        cursor: avatarInteractive ? 'pointer' : 'default',
        flexShrink: 0,
      }}
      src={avatarSrc || undefined}
      onClick={handleAvatarClick}
    >
      {!avatarSrc ? letter : null}
    </Avatar>
  );

  return (
    <Box display="flex" alignItems="center" gap={1} minWidth={0}>
      {avatarInteractive ? <Tooltip title={avatarTooltip}>{avatarEl}</Tooltip> : avatarEl}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle1" noWrap>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap display="block">
          {subtitle}
        </Typography>
      </Box>

      {showCopyInvite ? (
        <>
          <Tooltip title="Invite options">
            <IconButton
              aria-label="Chat menu"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              size="small"
              sx={{ flexShrink: 0 }}
            >
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={handleCopyInvite}>
              <LinkIcon fontSize="small" sx={{ mr: 1 }} />
              Copy invite link
            </MenuItem>
          </Menu>
        </>
      ) : null}

      {!emojiSidebarOpen && (
        <Box sx={{ ml: 'auto', flexShrink: 0 }}>
          <Tooltip title="Show emoji sidebar">
            <IconButton onClick={onShowEmojiSidebar}>
              <EmojiEmotionsOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default ChatHeader;
