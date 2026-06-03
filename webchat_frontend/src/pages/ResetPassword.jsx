import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import authService from '../services/authService';
import AuthPageLayout from '../components/auth/AuthPageLayout';
import AuthAnimatedItem from '../components/auth/AuthAnimatedItem';
import AuthErrorAlert from '../components/auth/AuthErrorAlert';
import GlassTextField from '../components/auth/GlassTextField';
import {
  authLinkButtonSx,
  authPrimaryButtonSx,
} from '../components/auth/authPageTheme';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const showError = (message) => {
    setSuccessMessage('');
    setError(message);
    setErrorShake(true);
    window.setTimeout(() => setErrorShake(false), 450);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setErrorShake(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      showError('Reset link is invalid. Request a new password reset from the login page.');
      return;
    }

    if (formData.newPassword.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await authService.resetPassword({
        token,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });
      setSuccessMessage(
        response?.message || 'Your password has been updated. You can sign in now.'
      );
    } catch (err) {
      showError(err.message || 'Unable to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token && !successMessage) {
    return (
      <AuthPageLayout
        title="Reset Password"
        footer={
          <>
            <Button component={RouterLink} to="/forgot-password" disableRipple sx={authLinkButtonSx}>
              Request new link
            </Button>
            {' · '}
            <Button component={RouterLink} to="/login" disableRipple sx={authLinkButtonSx}>
              Back to Login
            </Button>
          </>
        }
      >
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255, 255, 255, 0.9)', textAlign: 'center', lineHeight: 1.6 }}
          role="alert"
        >
          This reset link is missing or invalid. Request a new one from the forgot password page.
        </Typography>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      title="Reset Password"
      shake={errorShake}
      footer={
        successMessage ? (
          <Button
            component={RouterLink}
            to="/login"
            disableRipple
            sx={authLinkButtonSx}
            onClick={() => navigate('/login')}
          >
            Go to Login
          </Button>
        ) : (
          <>
            Need a new link?{' '}
            <Button component={RouterLink} to="/forgot-password" disableRipple sx={authLinkButtonSx}>
              Forgot Password
            </Button>
          </>
        )
      }
    >
      <AuthErrorAlert message={error} shake={errorShake} />

      {successMessage ? (
        <AuthAnimatedItem index={0}>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.92)',
              textAlign: 'center',
              px: 1,
              lineHeight: 1.6,
            }}
            role="status"
          >
            {successMessage}
          </Typography>
        </AuthAnimatedItem>
      ) : (
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <AuthAnimatedItem index={0}>
            <GlassTextField
              name="newPassword"
              type="password"
              placeholder="New password"
              autoComplete="new-password"
              value={formData.newPassword}
              onChange={handleChange}
              required
              disabled={loading}
              endIcon={LockOutlinedIcon}
            />
          </AuthAnimatedItem>

          <AuthAnimatedItem index={1}>
            <GlassTextField
              name="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading}
              endIcon={LockOutlinedIcon}
            />
          </AuthAnimatedItem>

          <AuthAnimatedItem index={2}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disableElevation
              disabled={loading}
              sx={{ ...authPrimaryButtonSx, mt: 1 }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: '#1a1a2e' }} />
              ) : (
                'Update Password'
              )}
            </Button>
          </AuthAnimatedItem>
        </Box>
      )}
    </AuthPageLayout>
  );
};

export default ResetPassword;
