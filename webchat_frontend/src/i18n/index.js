import en from './messages/en.js';
import uk from './messages/uk.js';

export const DEFAULT_LOCALE = 'en';
export const LOCALE_STORAGE_KEY = 'webchat:locale';

export const LOCALES = {
  en: { code: 'en', label: 'English', messages: en },
  uk: { code: 'uk', label: 'Українська', messages: uk },
};

export const LOCALE_OPTIONS = Object.values(LOCALES).map(({ code, label }) => ({
  code,
  label,
}));

export function applyDocumentLocale(locale) {
  const code = LOCALES[locale] ? locale : DEFAULT_LOCALE;
  document.documentElement.lang = code === 'uk' ? 'uk' : 'en';
}

export function translate(locale, key, params = {}) {
  const messages = LOCALES[locale]?.messages ?? LOCALES[DEFAULT_LOCALE].messages;
  let text = messages[key] ?? LOCALES[DEFAULT_LOCALE].messages[key];
  if (text == null) return key;
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, name) =>
    params[name] != null ? String(params[name]) : `{{${name}}}`,
  );
}

let localeGetter = () => DEFAULT_LOCALE;

export function bindLocaleGetter(getter) {
  localeGetter = getter;
}

/** For non-React modules; reads current locale from the store. */
export function t(key, params) {
  return translate(localeGetter(), key, params);
}
