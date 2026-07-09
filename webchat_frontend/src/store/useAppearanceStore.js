import { create } from 'zustand';
import { applyChatTheme } from '../theme/applyChatTheme';
import {
  applyFontScale,
  FONT_SCALE_STORAGE_KEY,
  readStoredFontScale,
} from '../theme/applyFontScale';
import { DEFAULT_CHAT_THEME_ID, getChatThemePreset } from '../theme/chatThemePresets';

const STORAGE_KEY = 'webchat:appearance-theme';

function readStoredThemeId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && getChatThemePreset(stored).id === stored) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CHAT_THEME_ID;
}

const initialThemeId = readStoredThemeId();
const initialFontScale = readStoredFontScale();
applyChatTheme(initialThemeId);
applyFontScale(initialFontScale);

const useAppearanceStore = create((set) => ({
  themeId: initialThemeId,
  fontScale: initialFontScale,

  setThemeId: (themeId) => {
    const preset = getChatThemePreset(themeId);
    applyChatTheme(preset.id);
    try {
      localStorage.setItem(STORAGE_KEY, preset.id);
    } catch {
      /* ignore */
    }
    set({ themeId: preset.id });
  },

  setFontScale: (fontScale) => {
    const clamped = applyFontScale(fontScale);
    try {
      localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
    set({ fontScale: clamped });
  },
}));

export default useAppearanceStore;
