import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import { Link as RouterLink } from 'react-router-dom';
import authService from '../services/authService';
import AuthPageLayout from '../components/auth/AuthPageLayout';
import AuthAnimatedItem from '../components/auth/AuthAnimatedItem';
import AuthErrorAlert from '../components/auth/AuthErrorAlert';
import GlassTextField from '../components/auth/GlassTextField';
import {
  authLinkButtonSx,
  authPrimaryButtonSx,
} from '../components/auth/authPageTheme';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      showError('Please enter your email address.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await authService.requestPasswordReset(trimmed);
      setSuccessMessage(
        response?.message ||
          'If an account exists for that email, you will receive password reset instructions shortly.'
      );
    } catch (err) {
      showError(err.message || 'Unable to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout
      title="Forgot Password"
      shake={errorShake}
      footer={
        <>
          Remember your password?{' '}
          <Button
            component={RouterLink}
            to="/login"
            disableRipple
            sx={authLinkButtonSx}
          >
            Back to Login
          </Button>
        </>
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
              mb: 2,
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
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.85)',
                textAlign: 'center',
                mb: 2,
                px: 0.5,
                lineHeight: 1.55,
              }}
            >
              Enter the email address linked to your account. We will send you a link to
              reset your password.
            </Typography>
          </AuthAnimatedItem>

          <AuthAnimatedItem index={1}>
            <GlassTextField
              name="email"
              type="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
                setErrorShake(false);
              }}
              required
              disabled={loading}
              endIcon={EmailOutlinedIcon}
              slotProps={{
                htmlInput: {
                  'aria-label': 'Email address',
                  autoCapitalize: 'none',
                  autoCorrect: 'off',
                },
              }}
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
                'Send Reset Link'
              )}
            </Button>
          </AuthAnimatedItem>
        </Box>
      )}
    </AuthPageLayout>
  );
};

export default ForgotPassword;
