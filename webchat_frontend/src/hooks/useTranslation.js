import { useCallback } from 'react';
import { translate } from '../i18n';
import useLocaleStore from '../store/useLocaleStore';

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const t = useCallback(
    (key, params) => translate(locale, key, params),
    [locale],
  );

  return { t, locale, setLocale };
}

export default useTranslation;
