import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import chatService from '../services/chatService';
import useChatStore from '../store/useChatStore';
import {
  categorizeAttachments,
  clearSharedMediaDeletionState,
  extractLinksFromMessages,
  fetchMessagesForLinkScan,
  getSharedMediaDeletionState,
  liveMessagesMediaSignature,
  mergeAttachments,
  mergeLinks,
  readSharedMediaCache,
  reconcileAttachments,
  reconcileLinks,
  writeSharedMediaCache,
} from '../utils/sharedMedia';

const EMPTY_MESSAGES = [];

function liveMessageAttachments(messages) {
  return (Array.isArray(messages) ? messages : []).flatMap((msg) =>
    Array.isArray(msg?.attachments) ? msg.attachments : [],
  );
}

function isActiveRoom(roomId) {
  return String(useChatStore.getState().currentChat?.id) === String(roomId);
}

export function useRoomSharedMedia(roomId, { enabled = true, loadLinks = false } = {}) {
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [linksLoading, setLinksLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [links, setLinks] = useState([]);
  const [trackedRoomId, setTrackedRoomId] = useState(roomId);
  const attachmentsGenerationRef = useRef(0);
  const linksGenerationRef = useRef(0);

  if (roomId !== trackedRoomId) {
    setTrackedRoomId(roomId);
    const cached = readSharedMediaCache(roomId);
    setAttachments(cached?.attachments ?? []);
    setLinks(cached?.links ?? []);
    setError(null);
    setAttachmentsLoading(Boolean(enabled && roomId && !cached?.attachments?.length));
    setLinksLoading(Boolean(enabled && roomId && loadLinks && !cached?.links?.length));
  }

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

  const resetForRoom = useCallback((nextRoomId) => {
    const cached = readSharedMediaCache(nextRoomId);
    setAttachments(cached?.attachments ?? []);
    setLinks(cached?.links ?? []);
    setError(null);
    return cached;
  }, []);

  const reloadAttachments = useCallback(async () => {
    if (!enabled || !roomId) {
      return;
    }

    const generation = ++attachmentsGenerationRef.current;
    const cached = readSharedMediaCache(roomId);
    if (!cached?.attachments?.length) {
      setAttachmentsLoading(true);
    }
    setError(null);

    try {
      const attachmentList = await chatService.getChatAttachments(roomId);
      if (generation !== attachmentsGenerationRef.current) return;

      const nextAttachments = Array.isArray(attachmentList) ? attachmentList : [];
      const live = isActiveRoom(roomId) ? useChatStore.getState().messages : [];
      const merged = mergeAttachments(nextAttachments, liveMessageAttachments(live));
      const reconciled = reconcileAttachments(merged, live, getSharedMediaDeletionState(roomId));

      clearSharedMediaDeletionState(roomId);
      setAttachments(reconciled);
    } catch (e) {
      if (generation !== attachmentsGenerationRef.current) return;
      const message =
        typeof e === 'string' ? e : e?.message || 'Failed to load shared media';
      setError(message);
      if (!cached) {
        setAttachments([]);
      }
    } finally {
      if (generation === attachmentsGenerationRef.current) {
        setAttachmentsLoading(false);
      }
    }
  }, [roomId, enabled]);

  const reloadLinks = useCallback(async () => {
    if (!enabled || !roomId || !loadLinks) {
      return;
    }

    const generation = ++linksGenerationRef.current;
    const cached = readSharedMediaCache(roomId);
    if (!cached?.links?.length) {
      setLinksLoading(true);
    }

    try {
      const messages = await fetchMessagesForLinkScan(chatService, roomId);
      if (generation !== linksGenerationRef.current) return;

      const scannedLinks = extractLinksFromMessages(messages);
      const liveLinks = isActiveRoom(roomId)
        ? extractLinksFromMessages(useChatStore.getState().messages)
        : [];
      const merged = mergeLinks(scannedLinks, liveLinks);
      const live = isActiveRoom(roomId) ? useChatStore.getState().messages : [];
      const deletionState = getSharedMediaDeletionState(roomId);
      setLinks(reconcileLinks(merged, live, deletionState));
    } catch {
      if (generation !== linksGenerationRef.current) return;
      if (!cached) {
        setLinks([]);
      }
    } finally {
      if (generation === linksGenerationRef.current) {
        setLinksLoading(false);
      }
    }
  }, [roomId, enabled, loadLinks]);

  const reload = useCallback(async () => {
    await Promise.all([reloadAttachments(), reloadLinks()]);
  }, [reloadAttachments, reloadLinks]);

  useEffect(() => {
    attachmentsGenerationRef.current += 1;
    linksGenerationRef.current += 1;

    if (!enabled || !roomId) {
      setAttachments([]);
      setLinks([]);
      setError(null);
      setAttachmentsLoading(false);
      setLinksLoading(false);
      return undefined;
    }

    const cached = resetForRoom(roomId);
    setAttachmentsLoading(!cached?.attachments?.length);
    setLinksLoading(loadLinks && !cached?.links?.length);
    void reloadAttachments();
    return undefined;
  }, [roomId, enabled, resetForRoom, reloadAttachments]);

  useEffect(() => {
    if (!enabled || !roomId || !loadLinks) {
      setLinksLoading(false);
      return undefined;
    }

    const cached = readSharedMediaCache(roomId);
    if (!cached?.links?.length) {
      setLinksLoading(true);
    }
    void reloadLinks();
    return () => {
      linksGenerationRef.current += 1;
    };
  }, [roomId, enabled, loadLinks, reloadLinks]);

  useEffect(() => {
    if (!roomId || !enabled) {
      return undefined;
    }

    const deletionState = getSharedMediaDeletionState(roomId);

    setAttachments((prev) => {
      const nextAttachments = reconcileAttachments(prev, liveMessages, deletionState);
      return nextAttachments.length === prev.length &&
        nextAttachments.every((item, index) => item?.id === prev[index]?.id)
        ? prev
        : nextAttachments;
    });

    setLinks((prev) => {
      const nextLinks = reconcileLinks(prev, liveMessages, deletionState);
      return nextLinks.length === prev.length &&
        nextLinks.every((item, index) => item?.url === prev[index]?.url)
        ? prev
        : nextLinks;
    });
  }, [roomId, enabled, liveMediaSignature, liveMessages]);

  useEffect(() => {
    if (roomId) {
      writeSharedMediaCache(roomId, attachments, links);
    }
  }, [roomId, attachments, links]);

  const media = useMemo(() => categorizeAttachments(attachments), [attachments]);
  const loading = attachmentsLoading || (loadLinks && linksLoading);

  return { loading, error, media, links, reload };
}
