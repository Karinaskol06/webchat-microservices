import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import authService from '../services/authService';
import AuthPageLayout from '../components/auth/AuthPageLayout';
import AuthAnimatedItem from '../components/auth/AuthAnimatedItem';
import AuthErrorAlert from '../components/auth/AuthErrorAlert';
import GlassPasswordField from '../components/auth/GlassPasswordField';
import {
  authLinkButtonSx,
  authPrimaryButtonSx,
} from '../components/auth/authPageTheme';
import useTranslation from '../hooks/useTranslation';

const ResetPassword = () => {
  const { t } = useTranslation();
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
      showError(t('auth.reset.error.invalidToken'));
      return;
    }

    if (formData.newPassword.length < 6) {
      showError(t('auth.reset.error.passwordTooShort'));
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      showError(t('auth.reset.error.passwordMismatch'));
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
        response?.message || t('auth.reset.success.fallback')
      );
    } catch (err) {
      showError(err.message || t('auth.reset.error.fallback'));
    } finally {
      setLoading(false);
    }
  };

  if (!token && !successMessage) {
    return (
      <AuthPageLayout
        title={t('auth.reset.title')}
        footer={
          <>
            <Button component={RouterLink} to="/forgot-password" disableRipple sx={authLinkButtonSx}>
              {t('auth.reset.footer.requestNewLink')}
            </Button>
            {' · '}
            <Button component={RouterLink} to="/login" disableRipple sx={authLinkButtonSx}>
              {t('auth.reset.footer.backToLogin')}
            </Button>
          </>
        }
      >
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255, 255, 255, 0.9)', textAlign: 'center', lineHeight: 1.6 }}
          role="alert"
        >
          {t('auth.reset.invalidLink')}
        </Typography>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      title={t('auth.reset.title')}
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
            {t('auth.reset.footer.goToLogin')}
          </Button>
        ) : (
          <>
            {t('auth.reset.footer.needNewLink')}{' '}
            <Button component={RouterLink} to="/forgot-password" disableRipple sx={authLinkButtonSx}>
              {t('auth.reset.footer.forgotPassword')}
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
            <GlassPasswordField
              name="newPassword"
              placeholder={t('auth.reset.newPassword.placeholder')}
              autoComplete="new-password"
              value={formData.newPassword}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </AuthAnimatedItem>

          <AuthAnimatedItem index={1}>
            <GlassPasswordField
              name="confirmPassword"
              placeholder={t('auth.reset.confirmPassword.placeholder')}
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading}
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
                t('auth.reset.submit')
              )}
            </Button>
          </AuthAnimatedItem>
        </Box>
      )}
    </AuthPageLayout>
  );
};

export default ResetPassword;
