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
import useTranslation from '../hooks/useTranslation';

const ForgotPassword = () => {
  const { t } = useTranslation();
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
      showError(t('auth.forgot.error.emailRequired'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await authService.requestPasswordReset(trimmed);
      setSuccessMessage(
        response?.message ||
          t('auth.forgot.success.fallback')
      );
    } catch (err) {
      showError(err.message || t('auth.forgot.error.fallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout
      title={t('auth.forgot.title')}
      shake={errorShake}
      footer={
        <>
          {t('auth.forgot.footer.remember')}{' '}
          <Button
            component={RouterLink}
            to="/login"
            disableRipple
            sx={authLinkButtonSx}
          >
            {t('auth.forgot.footer.backToLogin')}
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
              {t('auth.forgot.instructions')}
            </Typography>
          </AuthAnimatedItem>

          <AuthAnimatedItem index={1}>
            <GlassTextField
              name="email"
              type="email"
              placeholder={t('auth.forgot.email.placeholder')}
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
                  'aria-label': t('auth.forgot.email.ariaLabel'),
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
                t('auth.forgot.submit')
              )}
            </Button>
          </AuthAnimatedItem>
        </Box>
      )}
    </AuthPageLayout>
  );
};

export default ForgotPassword;
