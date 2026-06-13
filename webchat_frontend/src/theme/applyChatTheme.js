import { getChatThemePreset } from './chatThemePresets';

const CSS_VAR_MAP = {
  '--chat-bg-image': (p) => `url(${p.bgImage})`,
  '--chat-conversation-bg': (p) => p.colors.conversationBg,
  '--chat-bubble': (p) => p.colors.bubbleIncoming,
  '--chat-bubble-in': (p) => p.colors.bubbleIncoming,
  '--chat-bubble-out': (p) => p.colors.bubbleOutgoing,
  '--chat-composer-input-bg': (p) => p.colors.composerInputBg,
  '--chat-detail-page-bg': (p) => p.colors.detailPageBg,
  '--chat-primary': (p) => p.colors.primary,
  '--chat-primary-dark': (p) => p.colors.primaryDark,
  '--chat-primary-light': (p) => p.colors.primaryLight,
  '--chat-unread-badge': (p) => p.colors.unreadBadge,
  '--chat-glass-modal': (p) => p.colors.glassModal,
  '--chat-glass-modal-border': (p) => p.colors.glassModalBorder,
  '--chat-menu-paper-bg': (p) => p.colors.menuPaperBg,
  '--chat-primary-focus-ring': (p) => p.colors.primaryFocusRing,
  '--chat-primary-button-hover-shadow': (p) => p.colors.primaryButtonHoverShadow,
  '--chat-backdrop-bg': (p) => p.colors.backdropBg,
};

/** Apply preset colors to :root — updates instantly without a page reload. */
export function applyChatTheme(themeId) {
  const preset = getChatThemePreset(themeId);
  const root = document.documentElement;
  Object.entries(CSS_VAR_MAP).forEach(([name, resolve]) => {
    root.style.setProperty(name, resolve(preset));
  });
  return preset;
}
