import { create } from 'zustand';
import {
  bindLocaleGetter,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LOCALES,
  applyDocumentLocale,
} from '../i18n';

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && LOCALES[stored]) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

const initialLocale = readStoredLocale();
applyDocumentLocale(initialLocale);

const useLocaleStore = create((set) => ({
  locale: initialLocale,

  setLocale: (locale) => {
    const next = LOCALES[locale] ? locale : DEFAULT_LOCALE;
    applyDocumentLocale(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    set({ locale: next });
  },
}));

bindLocaleGetter(() => useLocaleStore.getState().locale);

export default useLocaleStore;
