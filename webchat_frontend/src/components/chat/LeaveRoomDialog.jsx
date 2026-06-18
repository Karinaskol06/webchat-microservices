import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import useTranslation from '../../hooks/useTranslation';
import { roomTypeLabel } from '../../utils/channelPermissions';

const LeaveRoomDialog = ({
  open,
  chat,
  roomLabel = '',
  loading = false,
  error = '',
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const roomType = roomTypeLabel(chat);
  const roomName = roomLabel || chat?.groupName || roomType;

  const handleClose = () => {
    if (loading) return;
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('chat.leaveDialog.title', { roomType })}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div" sx={{ lineHeight: 1.6 }}>
          {t('chat.leaveDialog.body', { roomName })}
        </DialogContentText>
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button
          color="warning"
          variant="contained"
          disabled={loading}
          onClick={() => onConfirm?.()}
        >
          {loading ? t('common.leaving') : t('common.leave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LeaveRoomDialog;
