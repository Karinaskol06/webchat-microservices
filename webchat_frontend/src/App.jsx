import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Navbar from './components/layout/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatPage from './pages/ChatPage';
import useAuthStore from './store/useAuthStore';
import authService from './services/authService';
import { Box, CircularProgress } from '@mui/material';

// ProtectedRoute component to guard routes that require authentication
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isInitialized } = useAuthStore();

  // While we are checking existing session, show a loader
  if (!isInitialized) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return children;
};

function App() {
  const { setUser } = useAuthStore();

  // Check for existing token and load user on app mount
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        // no token, mark as initialized with no user
        setUser(null);
        return;
      }

      try {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Failed to load user:', error);
        localStorage.removeItem('token');
        setUser(null);
      }
    };

    loadUser();
  }, [setUser]);

  return (
    <BrowserRouter>
      <Box sx={{ minHeight: '100vh', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/chat" 
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/chat" />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}

export default App;