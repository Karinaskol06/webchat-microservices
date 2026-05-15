import { createTheme } from '@mui/material/styles';
import { chatColors, chatGlassModalPaperSx, chatRadii } from './chatDesignTokens';

export const chatTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: chatColors.primary,
      dark: chatColors.primaryDark,
      light: chatColors.primaryLight,
      contrastText: chatColors.textOnPrimary,
    },
    secondary: {
      main: chatColors.surfaceLavender,
      contrastText: chatColors.textPrimary,
    },
    background: {
      default: chatColors.shellBg,
      paper: chatColors.surface,
    },
    text: {
      primary: chatColors.textPrimary,
      secondary: chatColors.textSecondary,
    },
    divider: chatColors.borderSubtle,
    success: { main: '#22C55E' },
    warning: { main: chatColors.accentOrange },
    info: { main: chatColors.accentBlue },
  },
  shape: {
    borderRadius: chatRadii.panel,
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    h6: { fontWeight: 700, letterSpacing: '-0.02em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, fontSize: '0.9375rem' },
    body1: { fontSize: '0.9375rem' },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem', color: chatColors.textSecondary },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: chatColors.shellBg,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: chatRadii.pill,
          textTransform: 'none',
          fontWeight: 600,
        },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 14px rgba(123, 97, 255, 0.35)' },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        rounded: {
          borderRadius: chatRadii.avatar,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 600,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: chatGlassModalPaperSx,
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(12, 8, 24, 0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: chatColors.textPrimary,
        },
      },
    },
    MuiDialogContentText: {
      styleOverrides: {
        root: {
          color: chatColors.textSecondary,
        },
      },
    },
  },
});

export default chatTheme;
