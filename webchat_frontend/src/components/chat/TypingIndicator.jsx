import React from 'react';
import { Box, Typography } from '@mui/material';
import useChatStore from '../../store/useChatStore';

const TypingIndicator = ({ otherUser }) => {
  const typingUsers = useChatStore((state) => state.typingUsers);

  if (!otherUser || !typingUsers?.[otherUser.id]) {
    return null;
  }

  const displayName =
    `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() ||
    otherUser.username ||
    'User';

  return (
    <Box
      sx={{
        px: 2,
        py: 0.5,
        bgcolor: 'background.default',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {displayName} is typing...
      </Typography>
    </Box>
  );
};

export default TypingIndicator;

