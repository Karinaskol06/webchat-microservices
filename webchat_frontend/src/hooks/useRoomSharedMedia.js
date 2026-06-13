import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import chatService from '../services/chatService';
import useChatStore from '../store/useChatStore';
import {
  categorizeAttachments,
  extractLinksFromMessages,
  fetchMessagesForLinkScan,
  liveMessagesMediaSignature,
  mergeAttachments,
  mergeLinks,
} from '../utils/sharedMedia';

const EMPTY_MESSAGES = [];
const mediaCache = new Map();

function readCache(roomId) {
  if (!roomId) return null;
  return mediaCache.get(String(roomId)) ?? null;
}

function writeCache(roomId, attachments, links) {
  if (!roomId) return;
  mediaCache.set(String(roomId), {
    attachments: Array.isArray(attachments) ? attachments : [],
    links: Array.isArray(links) ? links : [],
  });
}

export function useRoomSharedMedia(roomId, { enabled = true } = {}) {
  const cached = readCache(roomId);
  const [loading, setLoading] = useState(Boolean(enabled && roomId && !cached));
  const [error, setError] = useState(null);
  const [attachments, setAttachments] = useState(() => cached?.attachments ?? []);
  const [links, setLinks] = useState(() => cached?.links ?? []);

  const liveMessages = useChatStore(
    useShallow((state) =>
      roomId != null && String(state.currentChat?.id) === String(roomId)
        ? state.messages
        : EMPTY_MESSAGES,
    ),
  );

  const liveMediaSignature = useMemo(
    () => liveMessagesMediaSignature(liveMessages),
    [liveMessages],
  );

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!roomId) {
      setAttachments([]);
      setLinks([]);
      setError(null);
      setLoading(false);
      return;
    }

    const existing = readCache(roomId);
    if (existing) {
      setAttachments(existing.attachments);
      setLinks(existing.links);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [attachmentList, messages] = await Promise.all([
        chatService.getChatAttachments(roomId),
        fetchMessagesForLinkScan(chatService, roomId),
      ]);
      const nextAttachments = Array.isArray(attachmentList) ? attachmentList : [];
      const nextLinks = extractLinksFromMessages(messages);
      setAttachments((prev) => mergeAttachments(nextAttachments, prev));
      setLinks((prev) => mergeLinks(nextLinks, prev));
    } catch (e) {
      const message =
        typeof e === 'string' ? e : e?.message || 'Failed to load shared media';
      setError(message);
      if (!existing) {
        setAttachments([]);
        setLinks([]);
      }
    } finally {
      setLoading(false);
    }
  }, [roomId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!roomId || !enabled || !liveMediaSignature) {
      return undefined;
    }

    const messageAttachments = liveMessages.flatMap((msg) =>
      Array.isArray(msg?.attachments) ? msg.attachments : [],
    );
    const messageLinks = extractLinksFromMessages(liveMessages);

    setAttachments((prev) => {
      const merged = mergeAttachments(prev, messageAttachments);
      return merged.length === prev.length ? prev : merged;
    });

    setLinks((prev) => {
      const merged = mergeLinks(prev, messageLinks);
      return merged.length === prev.length ? prev : merged;
    });
  }, [roomId, enabled, liveMediaSignature, liveMessages]);

  useEffect(() => {
    if (roomId && (attachments.length > 0 || links.length > 0)) {
      writeCache(roomId, attachments, links);
    }
  }, [roomId, attachments, links]);

  const media = useMemo(() => categorizeAttachments(attachments), [attachments]);

  return { loading, error, media, links, reload: load };
}
