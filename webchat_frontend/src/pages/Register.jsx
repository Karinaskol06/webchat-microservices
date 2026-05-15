import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
} from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import useAuthStore from '../store/useAuthStore';
import PhoneCountryField from '../components/common/PhoneCountryField';
import { isValidInternationalPhone } from '../utils/internationalPhone';
import AuthPageLayout from '../components/auth/AuthPageLayout';
import AuthAnimatedItem from '../components/auth/AuthAnimatedItem';
import AuthErrorAlert from '../components/auth/AuthErrorAlert';
import GlassTextField from '../components/auth/GlassTextField';
import {
  authLinkButtonSx,
  authPrimaryButtonSx,
} from '../components/auth/authPageTheme';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    countryCode: 'UA',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [errorShake, setErrorShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const showError = (message) => {
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

    if (!formData.username || !formData.email || !formData.password) {
      showError('Please fill in all required fields.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }

    const phone = (formData.phoneNumber || '').trim();
    if (!phone) {
      showError('Phone number is required.');
      return;
    }
    if (!isValidInternationalPhone(phone)) {
      showError('Wrong phone number format');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setErrorShake(false);
      const { confirmPassword: _confirmPassword, ...registerData } = formData;

      await authService.register(registerData);

      const loginResponse = await authService.login({
        username: registerData.username,
        password: registerData.password,
      });

      const userData = await authService.getCurrentUser();
      login(userData, loginResponse.token);
      navigate('/chat');
    } catch (err) {
      showError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout
      title="Register"
      maxWidth={440}
      shake={errorShake}
      footer={
        <>
          Already have an account?{' '}
          <Button
            component={RouterLink}
            to="/login"
            disableRipple
            sx={authLinkButtonSx}
          >
            Login
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
          />
        </AuthAnimatedItem>

        <AuthAnimatedItem index={1}>
          <GlassTextField
            name="email"
            type="email"
            placeholder="Email ID"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
            endIcon={EmailOutlinedIcon}
          />
        </AuthAnimatedItem>

        <AuthAnimatedItem index={2}>
          <GlassTextField
            name="firstName"
            placeholder="First name"
            autoComplete="given-name"
            value={formData.firstName}
            onChange={handleChange}
            disabled={loading}
            endIcon={BadgeOutlinedIcon}
          />
        </AuthAnimatedItem>

        <AuthAnimatedItem index={3}>
          <GlassTextField
            name="lastName"
            placeholder="Last name"
            autoComplete="family-name"
            value={formData.lastName}
            onChange={handleChange}
            disabled={loading}
            endIcon={BadgeOutlinedIcon}
          />
        </AuthAnimatedItem>

        <AuthAnimatedItem index={4}>
          <Stack sx={{ mb: 1.75 }}>
            <PhoneCountryField
              glass
              phoneNumber={formData.phoneNumber}
              countryCode={formData.countryCode}
              onChange={({ phoneNumber, countryCode }) => {
                setFormData((prev) => ({ ...prev, phoneNumber, countryCode }));
                setError('');
                setErrorShake(false);
              }}
              disabled={loading}
            />
          </Stack>
        </AuthAnimatedItem>

        <AuthAnimatedItem index={5}>
          <GlassTextField
            name="password"
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
            endIcon={LockOutlinedIcon}
          />
        </AuthAnimatedItem>

        <AuthAnimatedItem index={6}>
          <GlassTextField
            name="confirmPassword"
            type="password"
            placeholder="Confirm password"
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            disabled={loading}
            endIcon={LockOutlinedIcon}
            sx={{ mb: 0.5 }}
          />
        </AuthAnimatedItem>

        <AuthAnimatedItem index={7}>
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
              'Register'
            )}
          </Button>
        </AuthAnimatedItem>
      </Box>
    </AuthPageLayout>
  );
};

export default Register;
