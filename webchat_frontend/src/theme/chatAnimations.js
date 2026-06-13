/** Motion tokens for chat workspace (CSS-only, reduced-motion safe). */

export const CHAT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const CHAT_EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const chatMotionKeyframes = {
  '@keyframes chatPanelIn': {
    from: {
      opacity: 0,
      transform: 'translate3d(0, 18px, 0) scale(0.98)',
    },
    to: {
      opacity: 1,
      transform: 'translate3d(0, 0, 0) scale(1)',
    },
  },
  '@keyframes chatBgSettle': {
    from: { transform: 'scale(1.05)' },
    to: { transform: 'scale(1)' },
  },
  '@keyframes chatListItemIn': {
    from: { opacity: 0, transform: 'translate3d(-8px, 0, 0)' },
    to: { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  },
  '@keyframes chatHeaderSwitch': {
    from: { opacity: 0, transform: 'translate3d(0, -6px, 0)' },
    to: { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  },
};

export const withChatReducedMotion = (motionSx, staticSx = {}) => ({
  ...motionSx,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none !important',
    transition: 'none !important',
    transform: 'none !important',
    opacity: 1,
    ...staticSx,
  },
});

export const chatStaggerDelay = (index, stepSec = 0.04) => `${(index * stepSec).toFixed(3)}s`;

export const chatBgSettleSx = withChatReducedMotion({
  animation: `chatBgSettle 1.1s ${CHAT_EASE_OUT} both`,
});

export const chatPanelEnterSx = (delaySec = 0) =>
  withChatReducedMotion({
    animation: `chatPanelIn 0.5s ${CHAT_EASE_OUT} ${delaySec}s both`,
    willChange: 'transform, opacity',
  });

export const chatListItemEnterSx = (index = 0) =>
  withChatReducedMotion({
    animation: `chatListItemIn 0.35s ${CHAT_EASE_OUT} ${chatStaggerDelay(index, 0.035)} both`,
  });

/** Optimistic chat switch — header updates immediately with a short enter. */
export const chatHeaderSwitchSx = withChatReducedMotion({
  animation: `chatHeaderSwitch 0.22s ${CHAT_EASE_OUT} both`,
});

/**
 * Message pane blur while the next conversation loads.
 * `active` true = blurred; fades to sharp quickly when loading completes.
 */
export const chatMessagesPanelBlurSx = (active) =>
  withChatReducedMotion(
    {
      filter: active ? 'blur(7px)' : 'blur(0px)',
      opacity: active ? 0.78 : 1,
      transform: active ? 'scale(0.994)' : 'scale(1)',
      transition: `filter 0.2s ${CHAT_EASE_OUT}, opacity 0.2s ${CHAT_EASE_OUT}, transform 0.2s ${CHAT_EASE_OUT}`,
      willChange: active ? 'filter, opacity, transform' : 'auto',
      pointerEvents: active ? 'none' : 'auto',
    },
    {
      filter: 'none',
      opacity: 1,
      transform: 'none',
      pointerEvents: 'auto',
    },
  );
