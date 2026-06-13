import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import chatService from '../../services/chatService';
import { fileToRoomPhotoDataUrl } from '../../utils/roomPhoto';
import { getApiErrorMessage } from '../../services/api';

const CreatePersonalSpaceDialog = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setPhotoPreview(null);
    setPhotoDataUrl(null);
    setError('');
    setSubmitting(false);
  }, [open]);

  const applyImageFile = useCallback(async (file) => {
    if (!file) return;
    setError('');
    try {
      const dataUrl = await fileToRoomPhotoDataUrl(file);
      setPhotoDataUrl(dataUrl);
      setPhotoPreview(dataUrl);
    } catch (e) {
      setPhotoDataUrl(null);
      setPhotoPreview(null);
      setError(e?.message || 'Could not use this image.');
    }
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const dto = await chatService.createPersonalSpace({
        name: trimmed,
        description: description.trim() || undefined,
        groupPhoto: photoDataUrl || undefined,
      });
      onCreated?.(dto);
      onClose?.();
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not create this personal space.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose?.()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        Create personal space
        <IconButton
          onClick={() => !submitting && onClose?.()}
          sx={{ ml: 'auto' }}
          aria-label="Close"
          disabled={submitting}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        ) : null}

        <TextField
          autoFocus
          fullWidth
          label="Space name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          margin="normal"
          disabled={submitting}
          inputProps={{ maxLength: 100 }}
        />

        <TextField
          fullWidth
          label="Purpose (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          margin="normal"
          multiline
          minRows={2}
          maxRows={6}
          placeholder="Notes, projects, reminders…"
          disabled={submitting}
          inputProps={{ maxLength: 2000 }}
        />

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
          Cover image (optional)
        </Typography>
        <Box
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: 'action.hover',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void applyImageFile(f);
            }}
          />
          {photoPreview ? (
            <Box
              component="img"
              src={photoPreview}
              alt=""
              sx={{ maxWidth: '100%', maxHeight: 160, borderRadius: 1, objectFit: 'cover' }}
            />
          ) : (
            <Box sx={{ py: 2 }}>
              <ImageIcon color="action" sx={{ fontSize: 40, opacity: 0.7 }} />
              <Typography variant="body2" color="text.secondary">
                Click to choose an image
              </Typography>
            </Box>
          )}
        </Box>
        {photoPreview ? (
          <Button
            size="small"
            sx={{ mt: 1 }}
            onClick={() => {
              setPhotoPreview(null);
              setPhotoDataUrl(null);
            }}
            disabled={submitting}
          >
            Remove image
          </Button>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => onClose?.()} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreatePersonalSpaceDialog;
