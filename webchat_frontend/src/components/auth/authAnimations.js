/** Motion tokens and keyframes for auth screens (CSS-only, reduced-motion safe). */

export const AUTH_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const AUTH_EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const authKeyframes = {
  '@keyframes authCardIn': {
    from: {
      opacity: 0,
      transform: 'translate3d(0, 28px, 0) scale(0.97)',
    },
    to: {
      opacity: 1,
      transform: 'translate3d(0, 0, 0) scale(1)',
    },
  },
  '@keyframes authFadeUp': {
    from: {
      opacity: 0,
      transform: 'translate3d(0, 14px, 0)',
    },
    to: {
      opacity: 1,
      transform: 'translate3d(0, 0, 0)',
    },
  },
  '@keyframes authFadeIn': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  '@keyframes authBgSettle': {
    from: { transform: 'scale(1.06)' },
    to: { transform: 'scale(1)' },
  },
  '@keyframes authAlertIn': {
    from: {
      opacity: 0,
      transform: 'translate3d(0, -8px, 0)',
    },
    to: {
      opacity: 1,
      transform: 'translate3d(0, 0, 0)',
    },
  },
  '@keyframes authShake': {
    '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
    '18%, 54%': { transform: 'translate3d(-5px, 0, 0)' },
    '36%, 72%': { transform: 'translate3d(5px, 0, 0)' },
  },
};

/** Merge motion styles; disables animation/transition when user prefers reduced motion. */
export const withReducedMotion = (motionSx, staticSx = {}) => ({
  ...motionSx,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none !important',
    transition: 'none !important',
    transform: 'none !important',
    opacity: 1,
    ...staticSx,
  },
});

export const staggerDelay = (index, stepSec = 0.055) => `${(index * stepSec).toFixed(3)}s`;

export const authCardEnterSx = withReducedMotion({
  animation: `authCardIn 0.55s ${AUTH_EASE_OUT} both`,
  willChange: 'transform, opacity',
});

export const authTitleEnterSx = withReducedMotion({
  animation: `authFadeUp 0.5s ${AUTH_EASE_OUT} 0.08s both`,
});

export const authFooterEnterSx = withReducedMotion({
  animation: `authFadeUp 0.45s ${AUTH_EASE_OUT} 0.32s both`,
});

export const authBgLayerSx = withReducedMotion({
  position: 'absolute',
  inset: 0,
  backgroundImage: 'inherit',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  animation: `authBgSettle 1.2s ${AUTH_EASE_OUT} both`,
  pointerEvents: 'none',
  zIndex: 0,
});

export const authRevealSx = (index = 0) =>
  withReducedMotion({
    animation: `authFadeUp 0.42s ${AUTH_EASE_OUT} ${staggerDelay(index)} both`,
    willChange: 'transform, opacity',
  });

export const authAlertEnterSx = withReducedMotion({
  animation: `authAlertIn 0.35s ${AUTH_EASE_OUT} both`,
});

export const authShakeSx = (active) =>
  active
    ? withReducedMotion({
        animation: `authShake 0.42s ${AUTH_EASE} both`,
      })
    : {};
