/** Named chat appearance presets (background image + conversation palette). */

export const DEFAULT_CHAT_THEME_ID = 'purple';

export const chatThemePresets = {
  purple: {
    id: 'purple',
    name: 'Purple',
    bgImage: '/login-bg.png',
    colors: {
      conversationBg: '#26185A',
      bubbleIncoming: '#18103D',
      bubbleOutgoing: '#18103D',
      composerInputBg: '#18103D',
      detailPageBg: '#1C1430',
      primary: '#7B61FF',
      primaryDark: '#6348E0',
      primaryLight: '#9B87FF',
      unreadBadge: '#7B61FF',
      glassModal: 'rgba(28, 20, 48, 0.88)',
      glassModalBorder: 'rgba(255, 255, 255, 0.22)',
      menuPaperBg: 'rgba(14, 8, 34, 0.97)',
      primaryFocusRing: 'rgba(123, 97, 255, 0.18)',
      primaryButtonHoverShadow: '0 4px 14px rgba(123, 97, 255, 0.35)',
      backdropBg: 'rgba(12, 8, 24, 0.55)',
    },
  },
  teal: {
    id: 'teal',
    name: 'Dark Teal',
    bgImage: '/teal-bg.jpg',
    colors: {
      conversationBg: '#19415D',
      bubbleIncoming: '#151D34',
      bubbleOutgoing: '#151D34',
      composerInputBg: '#151D34',
      detailPageBg: '#1D3B53',
      primary: '#3DB8CF',
      primaryDark: '#238DA3',
      primaryLight: '#5DD4E8',
      unreadBadge: '#3DB8CF',
      glassModal: 'rgba(21, 29, 52, 0.92)',
      glassModalBorder: 'rgba(255, 255, 255, 0.2)',
      menuPaperBg: 'rgba(12, 22, 40, 0.97)',
      primaryFocusRing: 'rgba(61, 184, 207, 0.22)',
      primaryButtonHoverShadow: '0 4px 14px rgba(61, 184, 207, 0.35)',
      backdropBg: 'rgba(8, 20, 32, 0.58)',
    },
  },
  maroon: {
    id: 'maroon',
    name: 'Maroon',
    bgImage: '/maroon-bg.jpg',
    colors: {
      conversationBg: '#4F1E31',
      bubbleIncoming: '#3A0012',
      bubbleOutgoing: '#3A0012',
      composerInputBg: '#3A0012',
      detailPageBg: '#4F1E31',
      primary: '#DE8FA8',
      primaryDark: '#C06D8E',
      primaryLight: '#F0B0C4',
      unreadBadge: '#DE8FA8',
      glassModal: 'rgba(70, 0, 22, 0.92)',
      glassModalBorder: 'rgba(255, 255, 255, 0.2)',
      menuPaperBg: 'rgba(40, 0, 14, 0.97)',
      primaryFocusRing: 'rgba(222, 143, 168, 0.22)',
      primaryButtonHoverShadow: '0 4px 14px rgba(222, 143, 168, 0.35)',
      backdropBg: 'rgba(20, 4, 10, 0.58)',
    },
  },
};

export const chatThemeList = Object.values(chatThemePresets);

export function getChatThemePreset(themeId) {
  return chatThemePresets[themeId] ?? chatThemePresets[DEFAULT_CHAT_THEME_ID];
}
