/** Design tokens for glass chat workspace + dark conversation area. */

import { alpha } from '@mui/material/styles';

/** MUI palette/sx cannot use the CSS keyword `transparent` (throws in getLuminance). */
export const muiTransparent = 'rgba(0, 0, 0, 0)';

/** MUI alpha/lighten need resolved hex — use inside sx `(theme) => ...` callbacks. */
export function themePrimaryAlpha(theme, opacity) {
  return alpha(theme.palette.primary.main, opacity);
}

export const chatColors = {
  navBg: muiTransparent,
  /** Nav + chat list typography on glass panels. */
  glassPanelText: '#10081a',
  glassPanelTextMuted: 'rgba(16, 8, 26, 0.62)',
  glassPanelBorder: 'rgba(16, 8, 26, 0.12)',
  navIcon: 'rgba(24, 20, 28, 0.65)',
  navIconActive: '#18141c',
  navActiveBg: 'rgba(24, 20, 28, 0.1)',
  shellBg: muiTransparent,
  /** Login-style glass (nav rail). */
  glassNav: 'rgba(255, 255, 255, 0.14)',
  /** More opaque glass for chat list / info panels. */
  glassList: 'rgba(255, 255, 255, 0.26)',
  surface: 'rgba(255, 255, 255, 0.35)',
  surfaceMuted: 'rgba(24, 20, 28, 0.08)',
  surfaceLavender: 'rgba(255, 255, 255, 0.22)',
  primary: 'var(--chat-primary, #7B61FF)',
  primaryDark: 'var(--chat-primary-dark, #6348E0)',
  primaryLight: 'var(--chat-primary-light, #9B87FF)',
  /** Conversation column (messages, header, composer). */
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  textOnPrimary: '#FFFFFF',
  borderSubtle: 'rgba(255, 255, 255, 0.14)',
  borderGlass: 'rgba(255, 255, 255, 0.32)',
  conversationBg: 'var(--chat-conversation-bg, #26185A)',
  /** Room profile + my profile dialog surfaces. */
  detailPageBg: 'var(--chat-detail-page-bg, #1C1430)',
  /** Darkened, less transparent glass for dialogs. */
  glassModal: 'var(--chat-glass-modal, rgba(28, 20, 48, 0.88))',
  glassModalBorder: 'var(--chat-glass-modal-border, rgba(255, 255, 255, 0.22))',
  bubbleIncoming: 'var(--chat-bubble-in, #18103D)',
  bubbleOutgoing: 'var(--chat-bubble-out, #18103D)',
  composerInputBg: 'var(--chat-composer-input-bg, #18103D)',
  bubbleText: '#FFFFFF',
  accentOrange: '#FF8A4C',
  accentBlue: '#4C8DFF',
  unreadBadge: 'var(--chat-unread-badge, #7B61FF)',
};

export const chatRadii = {
  shell: 28,
  panel: 22,
  bubble: 14,
  pill: 999,
  avatar: 14,
};

export const chatShadows = {
  panel: '0 12px 40px rgba(26, 20, 60, 0.32)',
  panelSoft: '0 8px 24px rgba(0, 0, 0, 0.28)',
};

export const chatLayout = {
  navRailWidth: 72,
  listWidth: 340,
  infoSidebarWidth: 300,
  gap: 12,
};

export const chatHideScrollbarSx = {
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  '&::-webkit-scrollbar': {
    display: 'none',
    width: 0,
    height: 0,
  },
};

const glassBase = {
  borderRadius: `${chatRadii.panel}px`,
  border: `1px solid ${chatColors.borderGlass}`,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: chatShadows.panel,
  overflow: 'hidden',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
};

/** Same glass treatment as login card. */
export const chatGlassNavSx = {
  ...glassBase,
  background: chatColors.glassNav,
};

/** Chat list — glass, less transparent than nav. */
export const chatGlassListSx = {
  ...glassBase,
  background: chatColors.glassList,
};

/** Group/channel side panels — same frosted glass as chat list. */
export const chatGlassRoomSideSx = {
  ...chatGlassListSx,
};

/** Solid conversation column. */
export const chatConversationPanelSx = {
  borderRadius: `${chatRadii.panel}px`,
  overflow: 'hidden',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  bgcolor: chatColors.conversationBg,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: chatShadows.panelSoft,
};

export const chatShellRootSx = {
  position: 'relative',
  display: 'flex',
  height: '100%',
  width: '100%',
  minHeight: 0,
  gap: `${chatLayout.gap}px`,
  p: { xs: 0, sm: 1, md: 1.5 },
  overflow: 'hidden',
  bgcolor: chatColors.shellBg,
};

export const chatShellBgLayerSx = {
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  backgroundImage: 'var(--chat-bg-image, url(/login-bg.png))',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
};

/** Search / inputs on glass list panel (dark text). */
export const chatGlassFieldPanelSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: `${chatRadii.pill}px`,
    bgcolor: 'rgba(16, 8, 26, 0.06)',
    color: chatColors.glassPanelText,
    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
    '& fieldset': {
      borderColor: chatColors.glassPanelBorder,
      transition: 'border-color 0.2s ease',
    },
    '&:hover fieldset': { borderColor: 'rgba(16, 8, 26, 0.22)' },
    '&.Mui-focused': {
      boxShadow: '0 0 0 3px var(--chat-primary-focus-ring, rgba(123, 97, 255, 0.18))',
    },
    '&.Mui-focused fieldset': { borderColor: chatColors.primary },
  },
  '& .MuiInputBase-input': {
    color: chatColors.glassPanelText,
    '&::placeholder': {
      color: chatColors.glassPanelTextMuted,
      opacity: 1,
    },
  },
};

/** Search / inputs on conversation column (light text). */
export const chatGlassFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: `${chatRadii.pill}px`,
    bgcolor: 'rgba(0, 0, 0, 0.22)',
    color: chatColors.textPrimary,
    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
    '& fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.35)',
      transition: 'border-color 0.2s ease',
    },
    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.55)' },
    '&.Mui-focused': {
      boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.1)',
    },
    '&.Mui-focused fieldset': { borderColor: 'rgba(255, 255, 255, 0.85)' },
  },
  '& .MuiInputBase-input': {
    color: chatColors.textPrimary,
    '&::placeholder': {
      color: 'rgba(255, 255, 255, 0.55)',
      opacity: 1,
    },
  },
};

/** Frosted dropdown for ⋮ menus (message + chat list). Blur applies to the menu panel only. */
export const chatMenuPaperSx = {
  borderRadius: `${chatRadii.panel}px`,
  border: `1px solid rgba(255, 255, 255, 0.16)`,
  background: 'var(--chat-menu-paper-bg, rgba(14, 8, 34, 0.97))',
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  boxShadow: '0 16px 48px rgba(8, 4, 22, 0.58)',
  color: chatColors.textPrimary,
  backgroundImage: 'none',
  '& .MuiMenuItem-root': {
    color: chatColors.textPrimary,
    fontSize: '0.875rem',
    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
  },
  '& .MuiListItemIcon-root': {
    color: chatColors.textSecondary,
    minWidth: 36,
  },
};

/**
 * ⋮ menus only — light dim behind the menu, no viewport blur (dialogs keep MuiBackdrop).
 */
export const chatMenuSlotProps = {
  backdrop: {
    sx: {
      backgroundColor: 'rgba(8, 4, 20, 0.48)',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    },
  },
  paper: {
    sx: chatMenuPaperSx,
  },
};

/** Frosted modal surface — opaque, slightly darkened. */
export const chatGlassModalPaperSx = {
  borderRadius: `${chatRadii.panel}px`,
  border: `1px solid ${chatColors.glassModalBorder}`,
  background: chatColors.glassModal,
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxShadow: '0 20px 56px rgba(12, 8, 28, 0.55)',
  color: chatColors.textPrimary,
  backgroundImage: 'none',
};
