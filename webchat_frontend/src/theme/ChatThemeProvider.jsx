import React, { useMemo } from 'react';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import useAppearanceStore from '../store/useAppearanceStore';
import { authKeyframes } from '../components/auth/authAnimations';
import { chatMotionKeyframes } from './chatAnimations';
import { createChatTheme } from './chatTheme';
import { getChatThemePreset } from './chatThemePresets';

const ChatThemeProvider = ({ children }) => {
  const themeId = useAppearanceStore((s) => s.themeId);
  const preset = useMemo(() => getChatThemePreset(themeId), [themeId]);
  const muiTheme = useMemo(() => createChatTheme(preset.colors), [preset]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <GlobalStyles styles={{ ...authKeyframes, ...chatMotionKeyframes }} />
      {children}
    </ThemeProvider>
  );
};

export default ChatThemeProvider;
