import { useCallback, useEffect, useRef, useState } from 'react';
import useChatStore from '../store/useChatStore';
import {
  WEBCHAT_INCOMING_MESSAGE_OPEN_CHAT,
  WEBCHAT_MESSAGES_MARKED_READ,
} from '../constants/chatEvents';
import {
  getLastReadEdge,
  persistReadEdgeFromMessages,
} from '../utils/readCursorStorage';

/**
 * Unread line on first open (from stored read edge or unreadCount) and a "New" line
 * when an incoming WS message arrives while this chat is focused.
 */
export function useUnreadMessageSeparator({
  userId,
  chatId,
  chatUnreadCount,
  messages,
}) {
  const [openSeparatorIndex, setOpenSeparatorIndex] = useState(null);
  const [liveBeforeMessageId, setLiveBeforeMessageId] = useState(null);
  const visitKeyRef = useRef('');
  const computedOpenForVisitRef = useRef(false);

  useEffect(() => {
    const key = `${userId ?? ''}:${chatId ?? ''}`;
    if (visitKeyRef.current !== key) {
      visitKeyRef.current = key;
      computedOpenForVisitRef.current = false;
      queueMicrotask(() => {
        setOpenSeparatorIndex(null);
        setLiveBeforeMessageId(null);
      });
    }
  }, [userId, chatId]);

  useEffect(() => {
    if (!userId || !chatId) return;
    if (!Array.isArray(messages) || messages.length === 0) {
      computedOpenForVisitRef.current = false;
      return;
    }
    if (computedOpenForVisitRef.current) return;
    computedOpenForVisitRef.current = true;

    const edge = getLastReadEdge(userId, chatId);
    let idx = null;
    if (edge?.timestamp) {
      const edgeMs = new Date(edge.timestamp).getTime();
      idx = messages.findIndex((m) => {
        const ms = new Date(m.timestamp).getTime();
        return Number.isFinite(ms) && ms > edgeMs;
      });
      if (idx < 0) idx = null;
    } else if (Number(chatUnreadCount) > 0) {
      idx = Math.max(0, messages.length - Number(chatUnreadCount));
    }
    queueMicrotask(() => {
      setOpenSeparatorIndex(idx);
    });
  }, [userId, chatId, messages, chatUnreadCount]);

  useEffect(() => {
    if (!chatId) return undefined;
    const handler = (e) => {
      const detail = e.detail || {};
      if (String(detail.chatId) !== String(chatId)) return;
      const senderId = detail.message?.senderId ?? detail.message?.sender?.id;
      if (!senderId || Number(senderId) === Number(userId)) return;
      const mid = detail.message?.id ?? detail.message?._id;
      if (mid != null && mid !== '') {
        setLiveBeforeMessageId(String(mid));
      }
    };
    window.addEventListener(WEBCHAT_INCOMING_MESSAGE_OPEN_CHAT, handler);
    return () =>
      window.removeEventListener(WEBCHAT_INCOMING_MESSAGE_OPEN_CHAT, handler);
  }, [chatId, userId]);

  const handleMarkedRead = useCallback(
    (e) => {
      if (String(e.detail?.chatId) !== String(chatId)) return;
      if (!userId || !chatId) return;
      const msgs = useChatStore.getState().messages;
      persistReadEdgeFromMessages(userId, chatId, msgs);
      setOpenSeparatorIndex(null);
      setLiveBeforeMessageId(null);
    },
    [userId, chatId],
  );

  useEffect(() => {
    window.addEventListener(WEBCHAT_MESSAGES_MARKED_READ, handleMarkedRead);
    return () =>
      window.removeEventListener(WEBCHAT_MESSAGES_MARKED_READ, handleMarkedRead);
  }, [handleMarkedRead]);

  return {
    openSeparatorIndex,
    liveBeforeMessageId,
  };
}
