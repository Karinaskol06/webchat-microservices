import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import userService from '../../services/userService';
import { getApiErrorMessage } from '../../services/api';
import useAuthStore from '../../store/useAuthStore';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import useTranslation from '../../hooks/useTranslation';

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

const AccountCredentialsPanel = ({ currentUser, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  const initialUsername = currentUser?.username || '';
  const initialEmail = currentUser?.email || '';

  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [usernameStatus, setUsernameStatus] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);

  const [accountBusy, setAccountBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const debouncedUsername = useDebouncedValue(username, 450);
  const debouncedEmail = useDebouncedValue(email, 450);

  const usernameDirty = username.trim() !== initialUsername;
  const emailDirty = email.trim().toLowerCase() !== (initialEmail || '').trim().toLowerCase();

  const usernameLocalError = useMemo(() => {
    const value = username.trim();
    if (!usernameDirty) return '';
    if (value.length < 3 || value.length > 50) return t('account.username.error.length');
    if (!USERNAME_PATTERN.test(value)) {
      return t('account.username.error.chars');
    }
    return '';
  }, [username, usernameDirty, t]);

  useEffect(() => {
    if (!usernameDirty || usernameLocalError) {
      setUsernameStatus(null);
      setUsernameChecking(false);
      return;
    }
    let cancelled = false;
    setUsernameChecking(true);
    userService
      .checkUsernameAvailability(debouncedUsername.trim())
      .then((result) => {
        if (!cancelled) setUsernameStatus(result);
      })
      .catch(() => {
        if (!cancelled) setUsernameStatus(null);
      })
      .finally(() => {
        if (!cancelled) setUsernameChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedUsername, usernameDirty, usernameLocalError]);

  useEffect(() => {
    if (!emailDirty || !email.trim()) {
      setEmailStatus(null);
      setEmailChecking(false);
      return;
    }
    let cancelled = false;
    setEmailChecking(true);
    userService
      .checkEmailAvailability(email.trim())
      .then((result) => {
        if (!cancelled) setEmailStatus(result);
      })
      .catch(() => {
        if (!cancelled) setEmailStatus(null);
      })
      .finally(() => {
        if (!cancelled) setEmailChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedEmail, emailDirty, email]);

  const canSaveAccount =
    (usernameDirty || emailDirty) &&
    !usernameLocalError &&
    (!usernameDirty || (usernameStatus?.available && !usernameChecking)) &&
    (!emailDirty || (emailStatus?.available && !emailChecking));

  const canSavePassword =
    oldPassword.length > 0 &&
    newPassword.length >= 6 &&
    newPassword === confirmPassword;

  const handleSaveAccount = async () => {
    setError('');
    setSuccess('');
    const payload = {};
    if (usernameDirty) payload.username = username.trim();
    if (emailDirty) payload.email = email.trim();
    if (!payload.username && !payload.email) {
      setError(t('account.error.changeBeforeSave'));
      return;
    }

    setAccountBusy(true);
    try {
      const result = await userService.updateAccount(payload);
      if (result?.usernameChanged) {
        setSuccess(result.message || t('account.success.usernameChanged'));
        window.setTimeout(() => {
          logout();
          onClose?.();
          navigate('/login', {
            state: {
              message:
                'Your username was updated. Sign in with your new username or email.',
            },
          });
        }, 1200);
        return;
      }
      if (result?.user) {
        setUser(result.user);
      }
      setSuccess(result?.message || t('account.success.updated'));
      setUsername(result?.user?.username || username.trim());
      setEmail(result?.user?.email || email.trim());
    } catch (err) {
      setError(getApiErrorMessage(err, t('account.error.update')));
    } finally {
      setAccountBusy(false);
    }
  };

  const handleSavePassword = async () => {
    setError('');
    setSuccess('');
    if (newPassword.length < 6) {
      setError(t('account.error.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('account.error.passwordMismatch'));
      return;
    }

    setPasswordBusy(true);
    try {
      const result = await userService.changePassword({
        oldPassword,
        newPassword,
        repeatPassword: confirmPassword,
      });
      setSuccess(result?.message || t('account.success.passwordChanged'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      window.setTimeout(() => {
        logout();
        onClose?.();
        navigate('/login', {
          state: { message: 'Your password was updated. Sign in with your new password.' },
        });
      }, 1200);
    } catch (err) {
      setError(getApiErrorMessage(err, t('account.error.changePassword')));
    } finally {
      setPasswordBusy(false);
    }
  };

  const usernameHelper = usernameLocalError
    || (usernameChecking ? t('account.username.checking') : usernameStatus?.message)
    || (usernameDirty ? '' : '');

  const emailHelper = emailChecking
    ? t('account.username.checking')
    : emailStatus?.message || '';

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        {t('account.intro')}
      </Typography>

      {error ? (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success">{success}</Alert>
      ) : null}

      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          {t('account.usernameEmail.title')}
        </Typography>
        <Stack spacing={2}>
          <TextField
            label={t('account.username.label')}
            size="small"
            fullWidth
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            error={
              Boolean(usernameLocalError)
              || (usernameDirty && usernameStatus && !usernameStatus.available)
            }
            helperText={usernameHelper}
            autoComplete="username"
          />
          <TextField
            label={t('account.email.label')}
            type="email"
            size="small"
            fullWidth
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            error={emailDirty && emailStatus && !emailStatus.available}
            helperText={emailHelper}
            autoComplete="email"
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              disabled={accountBusy || !canSaveAccount}
              onClick={() => void handleSaveAccount()}
            >
              {accountBusy ? t('common.saving') : t('account.save.usernameEmail')}
            </Button>
          </Box>
        </Stack>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          {t('account.password.title')}
        </Typography>
        <Stack spacing={2}>
          <TextField
            label={t('account.password.current')}
            type="password"
            size="small"
            fullWidth
            value={oldPassword}
            onChange={(e) => {
              setOldPassword(e.target.value);
              setError('');
            }}
            autoComplete="current-password"
          />
          <TextField
            label={t('account.password.new')}
            type="password"
            size="small"
            fullWidth
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setError('');
            }}
            helperText={t('account.password.hint')}
            autoComplete="new-password"
          />
          <TextField
            label={t('account.password.confirm')}
            type="password"
            size="small"
            fullWidth
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            error={confirmPassword.length > 0 && confirmPassword !== newPassword}
            helperText={
              confirmPassword.length > 0 && confirmPassword !== newPassword
                ? t('account.password.mismatch')
                : ''
            }
            autoComplete="new-password"
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              disabled={passwordBusy || !canSavePassword}
              onClick={() => void handleSavePassword()}
            >
              {passwordBusy ? t('common.saving') : t('account.password.change')}
            </Button>
          </Box>
        </Stack>
      </Box>

      {(accountBusy || passwordBusy) && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Stack>
  );
};

export default AccountCredentialsPanel;
