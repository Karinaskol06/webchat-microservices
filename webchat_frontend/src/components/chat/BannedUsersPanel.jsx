import React from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import UserAvatar from '../user/UserAvatar';
import { chatColors, muiTransparent } from '../../theme/chatDesignTokens';

const displayName = (u) => {
  if (!u) return 'Unknown';
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.username || `User ${u.id}`;
};

const BannedUsersPanel = ({ items, loading, error, onUnban, actionLoadingId }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="caption" sx={{ color: chatColors.glassPanelTextMuted }}>
        Banned members are unavailable right now.
      </Typography>
    );
  }

  if (!items.length) {
    return (
      <Typography variant="caption" sx={{ color: chatColors.glassPanelTextMuted }}>
        No banned users.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {items.map((user) => (
        <Box
          key={user.id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.5,
            px: 0.5,
          }}
        >
          <UserAvatar user={user} variant="rounded" sx={{ width: 32, height: 32, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{ color: chatColors.glassPanelText, fontWeight: 600, fontSize: '0.8125rem' }}
            >
              {displayName(user)}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            disabled={String(actionLoadingId) === String(user.id)}
            onClick={() => onUnban?.(user)}
            sx={{
              flexShrink: 0,
              minWidth: 0,
              px: 1.25,
              py: 0.25,
              fontSize: '0.7rem',
              borderColor: chatColors.glassPanelBorder,
              color: chatColors.glassPanelText,
            }}
          >
            Unban
          </Button>
        </Box>
      ))}
    </Box>
  );
};

export default BannedUsersPanel;
