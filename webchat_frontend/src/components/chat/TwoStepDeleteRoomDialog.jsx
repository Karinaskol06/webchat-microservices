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
import useTranslation from '../../hooks/useTranslation';

function resolveRoomType(label, t) {
  const lower = String(label || '').toLowerCase();
  if (lower.includes('channel')) return t('roomType.channel');
  if (lower.includes('group')) return t('roomType.group');
  if (lower.includes('personal')) return t('roomType.personalSpace');
  return label || t('roomType.room');
}

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
  const { t } = useTranslation();
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  const handleClose = () => {
    if (loading) return;
    onClose?.();
  };

  const roomType = resolveRoomType(roomTypeLabel, t);

  const title =
    step === 1
      ? t('room.delete.step1.title', { roomType })
      : t('room.delete.step2.title');

  const body =
    step === 1
      ? t('room.delete.step1.body', { roomLabel })
      : t('room.delete.step2.body', { roomType });

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
          {t('common.cancel')}
        </Button>
        {step === 1 ? (
          <Button color="error" variant="contained" onClick={() => setStep(2)} disabled={loading}>
            {t('room.delete.continue')}
          </Button>
        ) : (
          <Button
            color="error"
            variant="contained"
            disabled={loading}
            onClick={() => onConfirmDelete?.()}
          >
            {loading ? t('common.deleting') : t('room.delete.confirm')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TwoStepDeleteRoomDialog;
