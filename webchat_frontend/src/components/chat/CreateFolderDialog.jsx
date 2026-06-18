import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import useTranslation from '../../hooks/useTranslation';

const CreateFolderDialog = ({ open, onClose, onCreate }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    onCreate?.(trimmed);
    setSubmitting(false);
    onClose?.();
  };

  return (
    <Dialog
      key={open ? 'open' : 'closed'}
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>{t('folder.create.title')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={t('folder.create.name.label')}
            placeholder={t('folder.create.name.placeholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 48, 'aria-label': t('folder.create.name.label') }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || submitting}>
            {t('common.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreateFolderDialog;
