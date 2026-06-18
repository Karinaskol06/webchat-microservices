import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import useTranslation from '../../hooks/useTranslation';

function roomKindKey(roomType) {
  return String(roomType || '').toUpperCase() === 'CHANNEL' ? 'roomKind.channel' : 'roomKind.group';
}

const RoomBanDialog = ({ open, onClose, message, roomName, roomType }) => {
  const { t } = useTranslation();
  const kind = t(roomKindKey(roomType));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('roomBan.title', { kind })}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {message ||
            t('roomBan.body', {
              kind,
              roomName: roomName ? ` "${roomName}"` : '',
            })}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={onClose}>
          {t('common.ok')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoomBanDialog;
