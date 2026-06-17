import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItem,
  Typography,
} from '@mui/material';
import UserAvatar from '../user/UserAvatar';
import { chatColors } from '../../theme/chatDesignTokens';

const displayName = (u) => {
  if (!u) return 'Unknown';
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.username || `User ${u.id}`;
};

const usernameLabel = (u) => (u?.username ? `@${u.username}` : null);

/**
 * @param {'glass' | 'modal'} variant
 *   `glass` — light frosted sidebar panels (room info).
 *   `modal` — dark settings/dialog surfaces (theme text colors).
 */
const BannedUsersPanel = ({
  items,
  loading,
  error,
  onUnban,
  actionLoadingId,
  variant = 'glass',
}) => {
  const isModal = variant === 'modal';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: isModal ? 4 : 2 }}>
        <CircularProgress size={isModal ? 28 : 22} color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography
        variant="body2"
        sx={isModal ? { color: 'text.secondary' } : { color: chatColors.glassPanelTextMuted }}
      >
        Banned users are unavailable right now.
      </Typography>
    );
  }

  if (!items.length) {
    return (
      <Typography
        variant="body2"
        sx={
          isModal
            ? { color: 'text.secondary', py: 0.5 }
            : { color: chatColors.glassPanelTextMuted, fontSize: '0.75rem' }
        }
      >
        No banned users.
      </Typography>
    );
  }

  if (isModal) {
    return (
      <List
        disablePadding
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        {items.map((user, index) => {
          const busy = String(actionLoadingId) === String(user.id);
          const secondary = usernameLabel(user);
          return (
            <React.Fragment key={user.id}>
              <ListItem
                sx={{
                  gap: 1.5,
                  py: 1.25,
                  px: 1.5,
                  alignItems: 'center',
                }}
              >
                <UserAvatar user={user} sx={{ width: 40, height: 40, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={700} noWrap sx={{ color: 'text.primary' }}>
                    {displayName(user)}
                  </Typography>
                  {secondary ? (
                    <Typography variant="caption" noWrap display="block" sx={{ color: 'text.secondary' }}>
                      {secondary}
                    </Typography>
                  ) : null}
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  disabled={busy}
                  onClick={() => onUnban?.(user)}
                  sx={{
                    flexShrink: 0,
                    minWidth: 72,
                    fontWeight: 600,
                  }}
                >
                  {busy ? '…' : 'Unban'}
                </Button>
              </ListItem>
              {index < items.length - 1 ? <Divider component="li" /> : null}
            </React.Fragment>
          );
        })}
      </List>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {items.map((user) => {
        const busy = String(actionLoadingId) === String(user.id);
        return (
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
              {usernameLabel(user) ? (
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ color: chatColors.glassPanelTextMuted, display: 'block' }}
                >
                  {usernameLabel(user)}
                </Typography>
              ) : null}
            </Box>
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => onUnban?.(user)}
              sx={{
                flexShrink: 0,
                minWidth: 0,
                px: 1.25,
                py: 0.25,
                fontSize: '0.7rem',
                fontWeight: 600,
                borderColor: chatColors.glassPanelBorder,
                color: chatColors.glassPanelText,
                '&:hover': {
                  borderColor: chatColors.glassPanelTextMuted,
                  bgcolor: 'rgba(16, 8, 26, 0.06)',
                },
              }}
            >
              {busy ? '…' : 'Unban'}
            </Button>
          </Box>
        );
      })}
    </Box>
  );
};

export default BannedUsersPanel;
