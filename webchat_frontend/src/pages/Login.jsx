import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import useAuthStore from '../store/useAuthStore';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  
  // Error and loading state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error on input change
    setError('');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      // Login - this stores token
      const loginResponse = await authService.login(formData);
      
      // Now get user data (token is in localStorage and will be added by interceptor)
      const userData = await authService.getCurrentUser();
      
      // Update store
      login(userData, loginResponse.token);
      
      navigate('/chat');
      
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            Login to WebChat
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              margin="normal"
              required
              disabled={loading}
            />
            
            <TextField
              fullWidth
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
              disabled={loading}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Login'}
            </Button>
            
            <Typography variant="body2" align="center">
              Don't have an account?{' '}
              <Button color="primary" onClick={() => navigate('/register')}>
                Register
              </Button>
            </Typography>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;