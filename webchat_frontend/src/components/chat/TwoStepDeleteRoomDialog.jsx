import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';

/**
 * Two-step confirmation before permanently deleting a group or channel.
 */
const TwoStepDeleteRoomDialog = ({
  open,
  roomLabel,
  roomTypeLabel,
  loading = false,
  error = '',
  onClose,
  onConfirmDelete,
}) => {
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  const handleClose = () => {
    if (loading) return;
    onClose?.();
  };

  const title =
    step === 1
      ? `Delete ${roomTypeLabel}?`
      : 'Delete permanently?';

  const body =
    step === 1 ? (
      <>
        You are about to delete <strong>{roomLabel}</strong>. Members will lose access and all
        messages will be removed.
      </>
    ) : (
      <>
        This action <strong>cannot be undone</strong>. The {roomTypeLabel.toLowerCase()} and its
        entire message history will be deleted forever.
      </>
    );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{body}</DialogContentText>
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        {step === 1 ? (
          <Button color="error" variant="contained" onClick={() => setStep(2)} disabled={loading}>
            Continue
          </Button>
        ) : (
          <Button
            color="error"
            variant="contained"
            disabled={loading}
            onClick={() => onConfirmDelete?.()}
          >
            {loading ? 'Deleting…' : 'Delete forever'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TwoStepDeleteRoomDialog;
