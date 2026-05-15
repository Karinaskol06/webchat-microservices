import { useCallback, useEffect, useMemo, useState } from 'react';
import chatService from '../services/chatService';
import {
  categorizeAttachments,
  extractLinksFromMessages,
  fetchMessagesForLinkScan,
} from '../utils/sharedMedia';

export function useRoomSharedMedia(roomId, { enabled = true } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [links, setLinks] = useState([]);

  const load = useCallback(async () => {
    if (!roomId || !enabled) {
      setAttachments([]);
      setLinks([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [attachmentList, messages] = await Promise.all([
        chatService.getChatAttachments(roomId),
        fetchMessagesForLinkScan(chatService, roomId),
      ]);
      setAttachments(Array.isArray(attachmentList) ? attachmentList : []);
      setLinks(extractLinksFromMessages(messages));
    } catch (e) {
      const message =
        typeof e === 'string' ? e : e?.message || 'Failed to load shared media';
      setError(message);
      setAttachments([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [roomId, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const media = useMemo(() => categorizeAttachments(attachments), [attachments]);

  return { loading, error, media, links, reload: load };
}
