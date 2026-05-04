import React from 'react';
import { Avatar, Box, IconButton, Tooltip, Typography } from '@mui/material';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import { getPresenceLabel } from '../../utils/presence';

const ChatHeader = ({
  otherUser,
  presenceStatus,
  isTyping,
  emojiSidebarOpen,
  onOpenProfile,
  onShowEmojiSidebar,
}) => {
  return (
    <Box display="flex" alignItems="center">
      <Avatar
        sx={{ mr: 2, cursor: 'pointer' }}
        src={otherUser?.profilePicture || undefined}
        onClick={onOpenProfile}
      >
        {(otherUser?.firstName?.[0] ||
          otherUser?.username?.[0] ||
          'U'
        ).toUpperCase()}
      </Avatar>
      <Box>
        <Typography variant="subtitle1">
          {otherUser
            ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() ||
              otherUser.username
            : 'Chat'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {getPresenceLabel(presenceStatus, isTyping)}
        </Typography>
      </Box>

      {!emojiSidebarOpen && (
        <Box sx={{ ml: 'auto' }}>
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

