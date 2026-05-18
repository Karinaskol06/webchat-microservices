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

const messageTimestampMs = (m) => {
  const ms = new Date(m?.timestamp).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const findFirstUnreadIndex = (messages, edgeTimestampMs, unreadCount) => {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  if (edgeTimestampMs != null) {
    const idx = messages.findIndex((m) => {
      const ms = messageTimestampMs(m);
      return ms != null && ms > edgeTimestampMs;
    });
    return idx >= 0 ? idx : null;
  }

  if (unreadCount > 0) {
    return Math.max(0, messages.length - unreadCount);
  }

  return null;
};

/**
 * Shows an "Unread messages" line once per chat visit when there are missed messages.
 * Persists read edge on mark-as-read; revisiting the same chat does not show the line again
 * unless new messages arrived after the stored edge.
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
  const visitUnreadCountRef = useRef(0);
  useEffect(() => {
    const key = `${userId ?? ''}:${chatId ?? ''}`;
    if (visitKeyRef.current !== key) {
      visitKeyRef.current = key;
      computedOpenForVisitRef.current = false;

      if (chatId) {
        const state = useChatStore.getState();
        const fromList = state.chats.find((c) => String(c.id) === String(chatId));
        const raw =
          fromList?.unreadCount ??
          (String(state.currentChat?.id) === String(chatId)
            ? state.currentChat?.unreadCount
            : 0) ??
          chatUnreadCount ??
          0;
        visitUnreadCountRef.current = Math.max(0, Number(raw) || 0);
      } else {
        visitUnreadCountRef.current = 0;
      }

      queueMicrotask(() => {
        setOpenSeparatorIndex(null);
        setLiveBeforeMessageId(null);
      });
    }
  }, [userId, chatId, chatUnreadCount]);

  useEffect(() => {
    if (!userId || !chatId) return;
    if (!Array.isArray(messages) || messages.length === 0) {
      return;
    }
    if (computedOpenForVisitRef.current) return;
    computedOpenForVisitRef.current = true;

    const edge = getLastReadEdge(userId, chatId);
    const edgeMs = edge?.timestamp ? new Date(edge.timestamp).getTime() : null;
    const safeEdgeMs = Number.isFinite(edgeMs) ? edgeMs : null;

    const idx = findFirstUnreadIndex(
      messages,
      safeEdgeMs,
      visitUnreadCountRef.current,
    );

    queueMicrotask(() => {
      setOpenSeparatorIndex(idx);
    });
  }, [userId, chatId, messages]);

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
      // Keep the unread separator visible for this visit; edge prevents it on the next open.
      setLiveBeforeMessageId(null);
    },
    [userId, chatId],
  );

  useEffect(() => {
    window.addEventListener(WEBCHAT_MESSAGES_MARKED_READ, handleMarkedRead);
    return () =>
      window.removeEventListener(WEBCHAT_MESSAGES_MARKED_READ, handleMarkedRead);
  }, [handleMarkedRead]);

  const scrollToMessageId =
    openSeparatorIndex != null && openSeparatorIndex >= 0
      ? messages[openSeparatorIndex]?.id ?? messages[openSeparatorIndex]?._id ?? null
      : null;

  return {
    openSeparatorIndex,
    liveBeforeMessageId,
    scrollToMessageId,
  };
}
