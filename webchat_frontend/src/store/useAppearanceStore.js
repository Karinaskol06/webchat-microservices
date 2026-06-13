import { create } from 'zustand';
import { applyChatTheme } from '../theme/applyChatTheme';
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
applyChatTheme(initialThemeId);

const useAppearanceStore = create((set) => ({
  themeId: initialThemeId,

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
}));

export default useAppearanceStore;
