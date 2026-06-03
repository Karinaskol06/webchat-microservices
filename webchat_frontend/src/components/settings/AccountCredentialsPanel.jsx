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

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

const AccountCredentialsPanel = ({ currentUser, onClose }) => {
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
    if (value.length < 3 || value.length > 50) return 'Username must be between 3 and 50 characters';
    if (!USERNAME_PATTERN.test(value)) {
      return 'Only letters, numbers, dots, underscores, and hyphens';
    }
    return '';
  }, [username, usernameDirty]);

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
      setError('Change your username or email before saving.');
      return;
    }

    setAccountBusy(true);
    try {
      const result = await userService.updateAccount(payload);
      if (result?.usernameChanged) {
        setSuccess(result.message || 'Username updated. Please sign in again.');
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
      setSuccess(result?.message || 'Account details updated.');
      setUsername(result?.user?.username || username.trim());
      setEmail(result?.user?.email || email.trim());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update account.'));
    } finally {
      setAccountBusy(false);
    }
  };

  const handleSavePassword = async () => {
    setError('');
    setSuccess('');
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setPasswordBusy(true);
    try {
      const result = await userService.changePassword({
        oldPassword,
        newPassword,
        repeatPassword: confirmPassword,
      });
      setSuccess(result?.message || 'Password updated. Please sign in again.');
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
      setError(getApiErrorMessage(err, 'Could not change password.'));
    } finally {
      setPasswordBusy(false);
    }
  };

  const usernameHelper = usernameLocalError
    || (usernameChecking ? 'Checking availability…' : usernameStatus?.message)
    || (usernameDirty ? '' : '');

  const emailHelper = emailChecking
    ? 'Checking availability…'
    : emailStatus?.message || '';

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        Update your sign-in details. After a username or password change you will need to sign in
        again with the new credentials.
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
          Username &amp; email
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Username"
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
            label="Email"
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
              {accountBusy ? 'Saving…' : 'Save username & email'}
            </Button>
          </Box>
        </Stack>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          Password
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Current password"
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
            label="New password"
            type="password"
            size="small"
            fullWidth
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setError('');
            }}
            helperText="At least 6 characters"
            autoComplete="new-password"
          />
          <TextField
            label="Confirm new password"
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
                ? 'Passwords do not match'
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
              {passwordBusy ? 'Saving…' : 'Change password'}
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
