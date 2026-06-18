import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import ChatThemeProvider from './theme/ChatThemeProvider';
import './store/useLocaleStore';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChatThemeProvider>
      <App />
    </ChatThemeProvider>
  </React.StrictMode>,
);
