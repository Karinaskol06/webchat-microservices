import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import GroupsIcon from '@mui/icons-material/Groups';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import { chatColors, chatRadii } from '../../theme/chatDesignTokens';
import {
  getRoomInviteDescription,
  getRoomInviteInviterName,
  getRoomInviteRoomLabel,
  getRoomInviteRoomTypeLabel,
} from '../../utils/roomMemberInvite';

const RoomMemberInvitesPanel = ({
  invites = [],
  loading = false,
  onAccept,
  onDecline,
}) => {
  const list = Array.isArray(invites) ? invites : [];
  if (list.length === 0) return null;

  return (
    <Box
      component="section"
      aria-label="Room invitations"
      sx={{
        px: 1.5,
        pt: 1.25,
        pb: 1,
        borderBottom: `1px solid ${chatColors.glassPanelBorder}`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
        <MailOutlineIcon sx={{ fontSize: 18, color: chatColors.primary }} aria-hidden />
        <Typography
          variant="overline"
          sx={{
            flex: 1,
            letterSpacing: 0.08,
            fontWeight: 700,
            color: chatColors.glassPanelText,
            lineHeight: 1.2,
          }}
        >
          Invitations
        </Typography>
        <Typography
          component="span"
          variant="caption"
          sx={{
            fontWeight: 700,
            px: 0.75,
            py: 0.125,
            borderRadius: 1,
            bgcolor: chatColors.primary,
            color: chatColors.textOnPrimary,
            lineHeight: 1.4,
          }}
        >
          {list.length}
        </Typography>
      </Stack>

      <Stack spacing={1}>
        {list.map((invite) => {
          const isChannel = String(invite?.roomType || '').toUpperCase() === 'CHANNEL';
          const RoomIcon = isChannel ? CampaignOutlinedIcon : GroupsIcon;
          return (
            <Box
              key={invite.id}
              sx={{
                p: 1.25,
                borderRadius: `${chatRadii.md}px`,
                bgcolor: chatColors.surfaceMuted,
                border: `1px solid ${chatColors.glassPanelBorder}`,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(123, 97, 255, 0.12)',
                    color: chatColors.primary,
                  }}
                >
                  <RoomIcon sx={{ fontSize: 20 }} aria-hidden />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    noWrap
                    sx={{ color: chatColors.glassPanelText, lineHeight: 1.3 }}
                  >
                    {getRoomInviteRoomLabel(invite)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: chatColors.glassPanelTextMuted, lineHeight: 1.4 }}
                  >
                    {getRoomInviteInviterName(invite)} · {getRoomInviteRoomTypeLabel(invite)}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.375,
                      color: chatColors.glassPanelTextMuted,
                      lineHeight: 1.4,
                    }}
                  >
                    {getRoomInviteDescription(invite)}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={loading}
                  onClick={() => onAccept?.(invite)}
                  sx={{ flex: 1, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                >
                  Join
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={loading}
                  onClick={() => onDecline?.(invite)}
                  sx={{
                    flex: 1,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: chatColors.glassPanelBorder,
                    color: chatColors.glassPanelText,
                  }}
                >
                  Decline
                </Button>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

export default RoomMemberInvitesPanel;
