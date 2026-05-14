import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import chatService from '../../services/chatService';

const MAX_EDGE = 720;
const JPEG_QUALITY = 0.82;

function readFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid image'));
    };
    img.src = url;
  });
}

/** Resize and encode as JPEG data URL for Mongo-friendly room avatars. */
async function fileToRoomPhotoDataUrl(file) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Please use an image file (PNG, JPEG, WebP, GIF).');
  }
  const img = await readFileAsImage(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Could not read image dimensions.');
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

const CreateRoomDialog = ({ open, mode, onClose, onCreated }) => {
  const isChannel = mode === 'channel';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setVisibility('PUBLIC');
    setPhotoPreview(null);
    setPhotoDataUrl(null);
    setError('');
    setSubmitting(false);
  }, [open, mode]);

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

  const onPaste = useCallback(
    (e) => {
      if (!open) return;
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        if (it.type?.startsWith('image/')) {
          e.preventDefault();
          const f = it.getAsFile();
          if (f) applyImageFile(f);
          return;
        }
      }
    },
    [open, applyImageFile],
  );

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, onPaste]);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer?.files?.[0];
    if (f) applyImageFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const desc = description.trim();
      const payload = {
        name: trimmed,
        visibility,
        description: desc || undefined,
        groupPhoto: photoDataUrl || undefined,
        memberIds: [],
      };
      const dto = isChannel
        ? await chatService.createChannelRoom(payload)
        : await chatService.createGroupRoom(payload);
      onCreated?.(dto);
      onClose?.();
    } catch (e) {
      const msg =
        (typeof e === 'object' && e !== null && e.message) ||
        e?.error ||
        (typeof e === 'string' ? e : 'Could not create this room.');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const title = isChannel ? 'Create a channel' : 'Create a group chat';

  return (
    <Dialog open={open} onClose={() => !submitting && onClose?.()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        {title}
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
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          margin="normal"
          disabled={submitting}
        />

        <FormControl component="fieldset" margin="normal" fullWidth>
          <FormLabel component="legend">Visibility</FormLabel>
          <RadioGroup
            row
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            name="room-visibility"
          >
            <FormControlLabel value="PUBLIC" control={<Radio />} label="Public" disabled={submitting} />
            <FormControlLabel value="PRIVATE" control={<Radio />} label="Private" disabled={submitting} />
          </RadioGroup>
        </FormControl>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
          {isChannel
            ? 'Only you (the channel owner) can post. Others read messages. Private channels use invite links.'
            : 'Everyone in the group can post. Private groups use invite links; you and admins can copy the link.'}
        </Typography>

        <TextField
          fullWidth
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          margin="normal"
          multiline
          minRows={2}
          maxRows={6}
          placeholder="What is this room about?"
          disabled={submitting}
          inputProps={{ maxLength: 2000 }}
        />

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
          Room image (optional)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Drag and drop, choose a file, or paste an image (Ctrl+V) while this dialog is open.
        </Typography>

        <Box
          ref={dropZoneRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          role="button"
          tabIndex={0}
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
            outline: 'none',
            '&:focus-visible': {
              boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}`,
            },
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) applyImageFile(f);
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
                Drop image here or click to browse
              </Typography>
            </Box>
          )}
        </Box>

        {photoPreview ? (
          <Button size="small" sx={{ mt: 1 }} onClick={() => { setPhotoPreview(null); setPhotoDataUrl(null); }} disabled={submitting}>
            Remove image
          </Button>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => onClose?.()} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateRoomDialog;
