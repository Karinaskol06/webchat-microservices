/** Shared glass auth screen tokens (login / register). */

import { AUTH_EASE, withReducedMotion } from './authAnimations';
import { muiTransparent } from '../../theme/chatDesignTokens';

export const AUTH_BG_IMAGE = '/login-bg.png';

/** Scrollable area without visible scrollbar (register on short viewports). */
export const authHideScrollbarSx = {
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  '&::-webkit-scrollbar': {
    display: 'none',
    width: 0,
    height: 0,
  },
};

export const authPageRootSx = {
  width: '100%',
  height: '100%',
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  px: 2,
  py: 3,
  position: 'relative',
  overflow: 'hidden',
  overscrollBehavior: 'none',
  backgroundImage: `url(${AUTH_BG_IMAGE})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundAttachment: { xs: 'scroll', sm: 'fixed' },
};

export const authGlassCardSx = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  maxWidth: 420,
  maxHeight: 'calc(100dvh - 48px)',
  overflowX: 'hidden',
  overflowY: 'auto',
  ...authHideScrollbarSx,
  px: { xs: 3, sm: 4.5 },
  py: { xs: 3.5, sm: 4.5 },
  borderRadius: '22px',
  border: '1px solid rgba(255, 255, 255, 0.38)',
  background: 'rgba(255, 255, 255, 0.14)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 12px 40px rgba(26, 20, 60, 0.35)',
  '@media (prefers-reduced-motion: no-preference)': {
    transition: `box-shadow 0.25s ${AUTH_EASE}, border-color 0.25s ${AUTH_EASE}`,
    '&:focus-within': {
      boxShadow: '0 16px 48px rgba(26, 20, 60, 0.42)',
      borderColor: 'rgba(255, 255, 255, 0.48)',
    },
  },
};

export const authTitleSx = {
  color: '#fff',
  fontWeight: 700,
  textAlign: 'center',
  letterSpacing: '0.02em',
  mb: 3,
};

export const authFooterSx = {
  mt: 2.5,
  textAlign: 'center',
  color: 'rgba(255, 255, 255, 0.92)',
  fontSize: '0.9rem',
};

export const authLinkButtonSx = withReducedMotion({
  color: '#fff',
  fontWeight: 700,
  textTransform: 'none',
  fontSize: 'inherit',
  p: 0,
  minWidth: 0,
  verticalAlign: 'baseline',
  transition: `opacity 0.2s ${AUTH_EASE}, transform 0.2s ${AUTH_EASE}`,
  '&:hover': {
    backgroundColor: muiTransparent,
    textDecoration: 'underline',
    opacity: 0.92,
  },
  '&:active': {
    transform: 'scale(0.98)',
  },
});

export const authPrimaryButtonSx = withReducedMotion({
  mt: 2.5,
  py: 1.35,
  borderRadius: '999px',
  bgcolor: '#fff',
  color: '#1a1a2e',
  fontWeight: 700,
  fontSize: '1rem',
  textTransform: 'none',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
  transition: `background-color 0.22s ${AUTH_EASE}, box-shadow 0.22s ${AUTH_EASE}, transform 0.18s ${AUTH_EASE}`,
  '&:hover': {
    bgcolor: 'rgba(255, 255, 255, 0.92)',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
    transform: 'translateY(-1px)',
  },
  '&:active': {
    transform: 'translateY(0) scale(0.98)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
  },
  '&.Mui-disabled': {
    bgcolor: 'rgba(255, 255, 255, 0.55)',
    color: 'rgba(26, 26, 46, 0.5)',
    transform: 'none',
  },
});

/** Country-code Autocomplete panel on login / register (glass mode). */
export const glassCountryDropdownPaperSx = {
  mt: 0.75,
  borderRadius: '16px',
  border: '1px solid rgba(255, 255, 255, 0.42)',
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(40px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(40px) saturate(1.2)',
  boxShadow: '0 16px 48px rgba(26, 20, 60, 0.45)',
  overflow: 'hidden',
  backgroundImage: 'none',
  ...authHideScrollbarSx,
};

export const glassCountryDropdownListboxSx = {
  maxHeight: 280,
  py: 0.5,
  ...authHideScrollbarSx,
};

export const glassCountryDropdownOptionSx = {
  color: 'rgba(255, 255, 255, 0.95)',
  fontSize: '0.875rem',
  minHeight: 40,
  '&[aria-selected="true"]': {
    bgcolor: 'rgba(255, 255, 255, 0.2) !important',
  },
  '&.Mui-focused': {
    bgcolor: 'rgba(255, 255, 255, 0.12) !important',
  },
  '&:active': {
    bgcolor: 'rgba(255, 255, 255, 0.16) !important',
  },
};

export const glassFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '999px',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    color: '#fff',
    pr: 0.5,
    transition: `background-color 0.22s ${AUTH_EASE}, box-shadow 0.22s ${AUTH_EASE}`,
    '& fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.9)',
      transition: `border-color 0.22s ${AUTH_EASE}`,
    },
    '&:hover fieldset': {
      borderColor: '#fff',
    },
    '&.Mui-focused': {
      backgroundColor: 'rgba(0, 0, 0, 0.34)',
      boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.12)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#fff',
      borderWidth: '1px',
    },
    '&.Mui-disabled': {
      backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
  },
  '& .MuiOutlinedInput-input': {
    py: 1.35,
    px: 2.25,
    color: '#fff',
    '&::placeholder': {
      color: 'rgba(255, 255, 255, 0.78)',
      opacity: 1,
    },
  },
  '& .MuiFormHelperText-root': {
    color: 'rgba(255, 220, 220, 0.95)',
    mx: 2,
  },
};

export const glassCheckboxSx = {
  color: 'rgba(255, 255, 255, 0.85)',
  '&.Mui-checked': {
    color: '#fff',
  },
};

export const glassCheckboxLabelSx = {
  color: 'rgba(255, 255, 255, 0.92)',
  fontSize: '0.875rem',
};

export const authErrorAlertSx = {
  mb: 2,
  borderRadius: '12px',
  bgcolor: 'rgba(180, 40, 60, 0.35)',
  color: '#fff',
  border: '1px solid rgba(255, 180, 180, 0.4)',
  '& .MuiAlert-icon': { color: '#ffcdd2' },
};
