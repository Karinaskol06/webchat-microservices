import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Local draft for rich-message text fields — avoids parent re-render / API on every keystroke.
 * Syncs from server payload when `syncKey` changes and the field is not focused.
 */
export function useRichMessageDraft(syncKey, externalValue, defaultValue = '') {
  const [draft, setDraft] = useState(() => externalValue ?? defaultValue);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const focusedRef = useRef(false);
  const lastSyncKeyRef = useRef(syncKey);

  useEffect(() => {
    if (lastSyncKeyRef.current !== syncKey) {
      lastSyncKeyRef.current = syncKey;
      setDraft(externalValue ?? defaultValue);
      return;
    }
    if (!focusedRef.current) {
      setDraft(externalValue ?? defaultValue);
    }
  }, [syncKey, externalValue, defaultValue]);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const onBlur = useCallback((onPersist) => {
    focusedRef.current = false;
    onPersist?.(draftRef.current);
  }, []);

  return { draft, setDraft, onFocus, onBlur };
}
