import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import ChatThemeProvider from './theme/ChatThemeProvider';
import './store/useLocaleStore';
import { installExtensionNoiseFilter } from './utils/extensionNoiseFilter';
import { publishNotificationNavigation } from './utils/notificationNavigation';

installExtensionNoiseFilter();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'OPEN_CHAT_NOTIFICATION') {
      publishNotificationNavigation(data);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChatThemeProvider>
      <App />
    </ChatThemeProvider>
  </React.StrictMode>,
);
