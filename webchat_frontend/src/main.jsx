import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import App from './App';
import './index.css';
import chatTheme from './theme/chatTheme';
import { authKeyframes } from './components/auth/authAnimations';
import { chatMotionKeyframes } from './theme/chatAnimations';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={chatTheme}>
      <CssBaseline />
      <GlobalStyles styles={{ ...authKeyframes, ...chatMotionKeyframes }} />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

