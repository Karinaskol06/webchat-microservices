import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Typography,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import useAuthStore from '../store/useAuthStore';
import AuthPageLayout from '../components/auth/AuthPageLayout';
import AuthAnimatedItem from '../components/auth/AuthAnimatedItem';
import AuthErrorAlert from '../components/auth/AuthErrorAlert';
import GlassTextField from '../components/auth/GlassTextField';
import GlassPasswordField from '../components/auth/GlassPasswordField';
import {
  authLinkButtonSx,
  authPrimaryButtonSx,
  glassCheckboxLabelSx,
  glassCheckboxSx,
} from '../components/auth/authPageTheme';
import useTranslation from '../hooks/useTranslation';

const REMEMBER_KEY = 'webchat-remember-username';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const infoMessage = location.state?.message || '';

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const showError = (message) => {
    setError(message);
    setErrorShake(true);
    window.setTimeout(() => setErrorShake(false), 450);
  };

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setFormData((prev) => ({ ...prev, username: saved }));
      setRememberMe(true);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setErrorShake(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');

      const loginResponse = await authService.login(formData);
      const userData = await authService.getCurrentUser();

      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, formData.username.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      login(userData, loginResponse.token);
      navigate('/chat');
    } catch (err) {
      setError(err.message || t('auth.login.error.fallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout
      title={t('auth.login.title')}
      shake={errorShake}
      footer={
        <>
          {t('auth.login.footer.noAccount')}{' '}
          <Button
            component={RouterLink}
            to="/register"
            disableRipple
            sx={authLinkButtonSx}
          >
            {t('auth.login.footer.register')}
          </Button>
        </>
      }
    >
      {infoMessage ? (
        <AuthAnimatedItem index={-1}>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(200, 255, 220, 0.95)',
              textAlign: 'center',
              mb: 1.5,
              px: 1,
              lineHeight: 1.55,
            }}
            role="status"
          >
            {infoMessage}
          </Typography>
        </AuthAnimatedItem>
      ) : null}

      <AuthErrorAlert message={error} shake={errorShake} />

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <AuthAnimatedItem index={0}>
          <GlassTextField
            name="username"
            placeholder={t('auth.login.username.placeholder')}
            autoComplete="username"
            value={formData.username}
            onChange={handleChange}
            required
            disabled={loading}
            endIcon={PersonOutlineIcon}
            slotProps={{
              htmlInput: {
                'aria-label': t('auth.login.username.ariaLabel'),
                autoCapitalize: 'none',
                autoCorrect: 'off',
              },
            }}
          />
        </AuthAnimatedItem>

        <AuthAnimatedItem index={1}>
          <GlassPasswordField
            name="password"
            placeholder={t('auth.login.password.placeholder')}
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
          />
        </AuthAnimatedItem>

        <AuthAnimatedItem index={2}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
              mt: 0.5,
              mb: 0.5,
              px: 0.5,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                  size="small"
                  sx={glassCheckboxSx}
                />
              }
              label={t('auth.login.rememberMe')}
              sx={glassCheckboxLabelSx}
            />
            <Typography
              component={RouterLink}
              to="/forgot-password"
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.92)',
                textDecoration: 'none',
                transition: 'opacity 0.2s ease',
                '&:hover': { textDecoration: 'underline', opacity: 0.9 },
              }}
            >
              {t('auth.login.forgotPassword')}
            </Typography>
          </Box>
        </AuthAnimatedItem>

        <AuthAnimatedItem index={3}>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disableElevation
            disabled={loading}
            sx={authPrimaryButtonSx}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ color: '#1a1a2e' }} />
            ) : (
              t('auth.login.submit')
            )}
          </Button>
        </AuthAnimatedItem>
      </Box>
    </AuthPageLayout>
  );
};

export default Login;
