import React from 'react';
import { Box, Typography } from '@mui/material';
import { chatColors } from '../../theme/chatDesignTokens';

const MessageUnreadSeparator = ({ label = 'Unread messages' }) => (
  <Box
    role="separator"
    aria-label={label}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      my: 2,
      px: 0.5,
    }}
  >
    <Box sx={{ flex: 1, height: 1, bgcolor: chatColors.borderSubtle }} />
    <Typography
      variant="caption"
      sx={{
        color: chatColors.primaryLight,
        fontWeight: 600,
        letterSpacing: 0.04,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Typography>
    <Box sx={{ flex: 1, height: 1, bgcolor: chatColors.borderSubtle }} />
  </Box>
);

export default MessageUnreadSeparator;
