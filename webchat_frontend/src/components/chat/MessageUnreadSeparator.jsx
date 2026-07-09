import React from 'react';
import { Box, Typography } from '@mui/material';
import { chatColors, chatRadii } from '../../theme/chatDesignTokens';
import useTranslation from '../../hooks/useTranslation';

const separatorPillSx = {
  px: 1.5,
  py: 0.35,
  borderRadius: chatRadii.pill,
  bgcolor: 'rgba(255, 255, 255, 0.06)',
  backdropFilter: 'blur(6px)',
  fontWeight: 600,
  letterSpacing: 0.04,
  whiteSpace: 'nowrap',
};

const MessageUnreadSeparator = ({
  label,
  variant = 'unread',
  dayKey = null,
  dayLabel = null,
}) => {
  const { t } = useTranslation();
  const isDate = variant === 'date';
  const displayLabel = label ?? t('message.unreadSeparator');

  return (
    <Box
      role="separator"
      aria-label={displayLabel}
      data-day-marker={isDate ? '' : undefined}
      data-day-key={dayKey ?? undefined}
      data-day-label={isDate ? displayLabel : dayLabel ?? undefined}
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
          ...separatorPillSx,
          color: isDate ? chatColors.textSecondary : chatColors.primaryLight,
          textTransform: isDate ? 'none' : 'uppercase',
        }}
      >
        {displayLabel}
      </Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: chatColors.borderSubtle }} />
    </Box>
  );
};

export default MessageUnreadSeparator;
