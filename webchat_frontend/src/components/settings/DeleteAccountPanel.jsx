import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import userService from '../../services/userService';
import { getApiErrorMessage } from '../../services/api';
import useAuthStore from '../../store/useAuthStore';
import useTranslation from '../../hooks/useTranslation';

const DeleteAccountPanel = ({ currentUser, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const initialUsername = currentUser?.username || '';
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDeleteAccount = async () => {
    setError('');
    setSuccess('');
    if (deleteConfirmUsername.trim() !== initialUsername) {
      setError(t('account.delete.error.usernameMismatch'));
      return;
    }
    if (!deletePassword) {
      setError(t('account.delete.error.passwordRequired'));
      return;
    }

    setDeleteBusy(true);
    try {
      const result = await userService.deleteAccount({
        password: deletePassword,
        confirmUsername: deleteConfirmUsername.trim(),
      });
      setDeleteDialogOpen(false);
      setSuccess(result?.message || t('account.delete.success'));
      window.setTimeout(() => {
        logout();
        onClose?.();
        navigate('/login', {
          state: { message: result?.message || t('account.delete.success') },
        });
      }, 1200);
    } catch (err) {
      setError(getApiErrorMessage(err, t('account.delete.error.fallback')));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        {t('account.delete.description')}
      </Typography>

      {error ? (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success">{success}</Alert>
      ) : null}

      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'error.light',
          bgcolor: (theme) => theme.palette.error.main + '08',
          textAlign: 'center',
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} color="error.main" sx={{ mb: 1 }}>
          {t('account.delete.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('account.delete.warning')}
        </Typography>
        <Button
          variant="outlined"
          color="error"
          disabled={deleteBusy}
          onClick={() => {
            setDeleteDialogOpen(true);
            setDeletePassword('');
            setDeleteConfirmUsername('');
            setError('');
          }}
        >
          {t('account.delete.button')}
        </Button>
      </Box>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleteBusy && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('account.delete.dialog.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('account.delete.dialog.body')}
          </DialogContentText>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label={t('account.delete.dialog.username')}
              size="small"
              fullWidth
              value={deleteConfirmUsername}
              onChange={(e) => setDeleteConfirmUsername(e.target.value)}
              autoComplete="username"
              disabled={deleteBusy}
            />
            <TextField
              label={t('account.delete.dialog.password')}
              type="password"
              size="small"
              fullWidth
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
              disabled={deleteBusy}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteBusy}>
            {t('common.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteBusy}
            onClick={() => void handleDeleteAccount()}
          >
            {deleteBusy ? t('common.deleting') : t('account.delete.dialog.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {deleteBusy && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Stack>
  );
};

export default DeleteAccountPanel;
