import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Local drafts for to-do task text fields — avoids parent re-render / API on every keystroke.
 * Syncs from server tasks when the payload changes and a field is not focused.
 */
export function useTodoTaskDrafts(messageId, tasks) {
  const tasksKey = useMemo(
    () =>
      (Array.isArray(tasks) ? tasks : [])
        .map((t) => `${t.id}:${t.done ? 1 : 0}:${t.text ?? ''}`)
        .join('|'),
    [tasks],
  );

  const [draftById, setDraftById] = useState(() =>
    Object.fromEntries(
      (Array.isArray(tasks) ? tasks : []).map((t) => [t.id, t.text ?? '']),
    ),
  );
  const draftByIdRef = useRef(draftById);
  draftByIdRef.current = draftById;
  const focusedIdRef = useRef(null);
  const lastTasksKeyRef = useRef(`${messageId}|${tasksKey}`);

  useEffect(() => {
    const syncKey = `${messageId}|${tasksKey}`;
    if (lastTasksKeyRef.current === syncKey) {
      return;
    }
    lastTasksKeyRef.current = syncKey;

    setDraftById((prev) => {
      const next = { ...prev };
      for (const task of tasks) {
        if (focusedIdRef.current !== task.id) {
          next[task.id] = task.text ?? '';
        } else if (!(task.id in next)) {
          next[task.id] = task.text ?? '';
        }
      }
      for (const id of Object.keys(next)) {
        if (!tasks.some((t) => t.id === id)) {
          delete next[id];
        }
      }
      return next;
    });
  }, [messageId, tasksKey, tasks]);

  const setDraft = useCallback((taskId, text) => {
    setDraftById((prev) => ({ ...prev, [taskId]: text }));
  }, []);

  const onFocus = useCallback((taskId) => {
    focusedIdRef.current = taskId;
  }, []);

  const onBlur = useCallback((taskId, onPersist) => {
    if (focusedIdRef.current === taskId) {
      focusedIdRef.current = null;
    }
    onPersist?.(draftByIdRef.current[taskId] ?? '');
  }, []);

  const mergeDrafts = useCallback(
    (baseTasks = tasks) =>
      baseTasks.map((t) => ({
        ...t,
        text: draftByIdRef.current[t.id] ?? t.text ?? '',
      })),
    [tasks],
  );

  return { draftById, setDraft, onFocus, onBlur, mergeDrafts };
}
