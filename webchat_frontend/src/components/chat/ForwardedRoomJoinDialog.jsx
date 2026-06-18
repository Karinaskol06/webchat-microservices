import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import LockIcon from '@mui/icons-material/Lock';
import chatService from '../../services/chatService';
import { getApiErrorMessage } from '../../services/api';
import { parseRoomBanError } from '../../utils/roomBanError';
import useChatStore from '../../store/useChatStore';
import { chatColors, chatGlassModalPaperSx } from '../../theme/chatDesignTokens';
import useTranslation from '../../hooks/useTranslation';

function roomKindKey(type) {
  return String(type || '').toUpperCase() === 'CHANNEL' ? 'roomKind.channel' : 'roomKind.group';
}

function roomKindTitleKey(type) {
  return String(type || '').toUpperCase() === 'CHANNEL' ? 'roomType.channel' : 'roomType.groupShort';
}

export default function ForwardedRoomJoinDialog({
  open,
  room,
  onClose,
  onJoined,
}) {
  const { t } = useTranslation();
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState('');
  const [banInfo, setBanInfo] = useState(null);

  useEffect(() => {
    if (!open) {
      setError('');
      setBanInfo(null);
      setJoinLoading(false);
    }
  }, [open]);

  const roomName = room?.name || room?.groupName || t('forwardedRoom.fallbackRoom');
  const roomType = room?.type;
  const visibility = String(room?.visibility || 'PRIVATE').toUpperCase();
  const isPublic = visibility === 'PUBLIC';
  const kind = t(roomKindKey(roomType));
  const KindIcon = String(roomType || '').toUpperCase() === 'CHANNEL' ? CampaignOutlinedIcon : GroupsIcon;

  const handleJoin = async () => {
    if (!room?.id) return;
    setJoinLoading(true);
    setError('');
    setBanInfo(null);
    try {
      const dto = await chatService.joinPublicRoom(room.id);
      useChatStore.getState().upsertChat(dto);
      onJoined?.(dto);
      onClose?.();
    } catch (e) {
      const ban = parseRoomBanError(e);
      if (ban) {
        setBanInfo(ban);
        return;
      }
      setError(getApiErrorMessage(e, t('forwardedRoom.error.join', { kind })));
    } finally {
      setJoinLoading(false);
    }
  };

  const banKind = t(roomKindKey(banInfo?.roomType || roomType));

  return (
    <Dialog
      open={open}
      onClose={joinLoading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: chatGlassModalPaperSx } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <KindIcon sx={{ color: chatColors.primary }} fontSize="small" />
        {t(roomKindTitleKey(roomType))}
      </DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          {roomName}
        </Typography>
        {banInfo ? (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {banInfo.message || t('forwardedRoom.ban.fallback', { kind: banKind })}
          </Typography>
        ) : isPublic ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('forwardedRoom.joinPublic.body', { kind })}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'flex-start' }}>
            <LockIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.25 }} />
            <Typography variant="body2" color="text.secondary">
              {t('forwardedRoom.private.body', { kind })}
            </Typography>
          </Box>
        )}
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={joinLoading}>
          {t('common.close')}
        </Button>
        {isPublic && !banInfo ? (
          <Button variant="contained" disabled={joinLoading} onClick={() => void handleJoin()}>
            {joinLoading ? t('common.joining') : t('forwardedRoom.join', { kind })}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
