export const FONT_SCALE_MIN = 0.875;
export const FONT_SCALE_MAX = 1.125;
export const FONT_SCALE_DEFAULT = 1;
export const FONT_SCALE_STORAGE_KEY = 'webchat:appearance-font-scale';

export function clampFontScale(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return FONT_SCALE_DEFAULT;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, parsed));
}

export function readStoredFontScale() {
  try {
    const stored = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (stored != null && stored !== '') {
      return clampFontScale(stored);
    }
  } catch {
    /* ignore */
  }
  return FONT_SCALE_DEFAULT;
}

/** Apply root font scale — rem-based UI updates instantly. */
export function applyFontScale(scale) {
  const clamped = clampFontScale(scale);
  document.documentElement.style.setProperty('--chat-font-scale', String(clamped));
  return clamped;
}
