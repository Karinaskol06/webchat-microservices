import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { roomBanLabel } from '../../utils/roomBanError';

const RoomBanDialog = ({ open, onClose, message, roomName, roomType }) => {
  const kind = roomBanLabel(roomType);
  const title = `Banned from this ${kind}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {message ||
            `You have been banned from the ${kind}${roomName ? ` "${roomName}"` : ''} and cannot join again unless a moderator unbans you.`}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={onClose}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoomBanDialog;
