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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import useAuthStore from '../store/useAuthStore';
import AuthPageLayout from '../components/auth/AuthPageLayout';
import AuthAnimatedItem from '../components/auth/AuthAnimatedItem';
import AuthErrorAlert from '../components/auth/AuthErrorAlert';
import GlassTextField from '../components/auth/GlassTextField';
import {
  authLinkButtonSx,
  authPrimaryButtonSx,
  glassCheckboxLabelSx,
  glassCheckboxSx,
} from '../components/auth/authPageTheme';

const REMEMBER_KEY = 'webchat-remember-username';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

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
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout
      title="Login"
      shake={errorShake}
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Button
            component={RouterLink}
            to="/register"
            disableRipple
            sx={authLinkButtonSx}
          >
            Register
          </Button>
        </>
      }
    >
      <AuthErrorAlert message={error} shake={errorShake} />

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <AuthAnimatedItem index={0}>
          <GlassTextField
            name="username"
            placeholder="Username"
            autoComplete="username"
            value={formData.username}
            onChange={handleChange}
            required
            disabled={loading}
            endIcon={PersonOutlineIcon}
            slotProps={{
              htmlInput: {
                'aria-label': 'Username',
                autoCapitalize: 'none',
                autoCorrect: 'off',
              },
            }}
          />
        </AuthAnimatedItem>

        <AuthAnimatedItem index={1}>
          <GlassTextField
            name="password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
            endIcon={LockOutlinedIcon}
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
              label="Remember me"
              sx={glassCheckboxLabelSx}
            />
            <Typography
              component="button"
              type="button"
              variant="body2"
              onClick={() =>
                showError('Password reset is not available yet. Contact support.')
              }
              sx={{
                border: 0,
                bgcolor: 'transparent',
                color: 'rgba(255, 255, 255, 0.92)',
                cursor: 'pointer',
                font: 'inherit',
                p: 0,
                transition: 'opacity 0.2s ease',
                '&:hover': { textDecoration: 'underline', opacity: 0.9 },
              }}
            >
              Forgot Password?
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
              'Login'
            )}
          </Button>
        </AuthAnimatedItem>
      </Box>
    </AuthPageLayout>
  );
};

export default Login;
