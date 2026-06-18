import React from 'react';
import { Box, Typography } from '@mui/material';
import { chatColors } from '../../theme/chatDesignTokens';
import useTranslation from '../../hooks/useTranslation';

const MessageUnreadSeparator = ({ label }) => {
  const { t } = useTranslation();
  const displayLabel = label ?? t('message.unreadSeparator');

  return (
    <Box
      role="separator"
      aria-label={displayLabel}
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
        {displayLabel}
      </Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: chatColors.borderSubtle }} />
    </Box>
  );
};

export default MessageUnreadSeparator;
