import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Navbar from './components/layout/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatPage from './pages/ChatPage';
import JoinInvitePage from './pages/JoinInvitePage';
import useAuthStore from './store/useAuthStore';
import useChatStore from './store/useChatStore';
import authService from './services/authService';
import { disconnectWebSocket } from './utils/websocket';
import chatService from './services/chatService';
import pushNotificationService from './services/pushNotificationService';
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

function AppRoutes() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const isAuthScreen =
    location.pathname === '/login' || location.pathname === '/register';
  const hideNavbar =
    isAuthScreen || (isAuthenticated && location.pathname.startsWith('/chat'));

  return (
    <Box sx={{ minHeight: '100vh', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!hideNavbar && <Navbar />}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: isAuthScreen ? 'hidden' : undefined,
        }}
      >
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
          <Route
            path="/join/:token"
            element={
              <ProtectedRoute>
                <JoinInvitePage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/chat" />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  const { setUser, isAuthenticated, user } = useAuthStore();

  // Check for existing token and load user on app mount
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        disconnectWebSocket();
        useChatStore.getState().clearStore();
        setUser(null);
        return;
      }

      try {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Failed to load user:', error);
        localStorage.removeItem('token');
        disconnectWebSocket();
        useChatStore.getState().clearStore();
        setUser(null);
      }
    };

    loadUser();
  }, [setUser]);

  // Keep the dependency on the stable primitive `user?.id` (and not the full
  // `user` object) so unrelated store updates don't re-trigger subscription
  // negotiation. The single source of truth for subscribing is "we have an
  // authenticated user"; the older mount-only fallback used to race with
  // this effect and corrupt the backend's record of the active endpoint.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }
    pushNotificationService.ensureSubscription().catch((error) => {
      console.warn('Push subscription setup failed:', error);
    });
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }
    const onServiceWorkerMessage = (event) => {
      const { type, chatId } = event.data || {};
      if (type === 'MARK_CHAT_READ' && chatId) {
        chatService.markAsRead(chatId).catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
    };
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;