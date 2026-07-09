import { useCallback, useEffect, useRef, useState } from 'react';
import { messageDayKey } from '../utils/messageDate';

const SCROLL_DATE_HIDE_MS = 900;
const SCROLL_ANCHOR_OFFSET_PX = 44;

export function useMessageScrollDateTag(viewportRef, enabled = true) {
  const [scrollDateLabel, setScrollDateLabel] = useState('');
  const [showScrollDate, setShowScrollDate] = useState(false);
  const hideTimerRef = useRef(null);

  const resolveScrollDateLabel = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return '';

    const anchorY = vp.getBoundingClientRect().top + SCROLL_ANCHOR_OFFSET_PX;
    const rows = vp.querySelectorAll('[data-message-day-label]');
    let label = '';

    rows.forEach((el) => {
      const { top } = el.getBoundingClientRect();
      if (top <= anchorY) {
        label = el.dataset.messageDayLabel || label;
      }
    });

    return label;
  }, [viewportRef]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setShowScrollDate(false);
    }, SCROLL_DATE_HIDE_MS);
  }, [clearHideTimer]);

  const updateFromScroll = useCallback(() => {
    const label = resolveScrollDateLabel();
    if (!label) {
      setShowScrollDate(false);
      return;
    }
    setScrollDateLabel(label);
    setShowScrollDate(true);
    scheduleHide();
  }, [resolveScrollDateLabel, scheduleHide]);

  useEffect(() => {
    if (!enabled) {
      setShowScrollDate(false);
      return undefined;
    }

    const vp = viewportRef.current;
    if (!vp) return undefined;

    const onScroll = () => {
      updateFromScroll();
    };

    vp.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      vp.removeEventListener('scroll', onScroll);
      clearHideTimer();
    };
  }, [clearHideTimer, enabled, updateFromScroll, viewportRef]);

  return { scrollDateLabel, showScrollDate };
}

export function buildMessageDayMeta(messages, formatDayLabel) {
  if (!Array.isArray(messages)) return [];
  return messages.map((message, index) => {
    const dayKey = messageDayKey(message?.timestamp);
    const dayLabel = dayKey && formatDayLabel ? formatDayLabel(message.timestamp) : null;
    const showDaySeparator =
      dayKey != null &&
      (index === 0 || dayKey !== messageDayKey(messages[index - 1]?.timestamp));
    const separatorLabel = showDaySeparator ? dayLabel : null;
    return { message, showDaySeparator, dayKey, dayLabel, separatorLabel };
  });
}
