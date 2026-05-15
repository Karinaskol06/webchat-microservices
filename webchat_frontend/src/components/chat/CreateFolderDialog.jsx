import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';

const CreateFolderDialog = ({ open, onClose, onCreate }) => {
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
        <DialogTitle>New chat folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Folder name"
            placeholder="e.g. Work, Family"
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 48, 'aria-label': 'Folder name' }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || submitting}>
            Create
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreateFolderDialog;
