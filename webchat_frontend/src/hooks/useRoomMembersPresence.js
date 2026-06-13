import { useEffect, useMemo, useState } from 'react';
import chatService from '../services/chatService';

export function useRoomMembersPresence(roomId, members, { enabled = true } = {}) {
  const memberIds = useMemo(
    () =>
      (Array.isArray(members) ? members : [])
        .map((m) => Number(m?.id))
        .filter((id) => Number.isFinite(id) && id > 0),
    [members],
  );

  const memberIdsKey = memberIds.join(',');

  const [presenceByUserId, setPresenceByUserId] = useState({});

  useEffect(() => {
    if (!enabled || !roomId || memberIds.length === 0) {
      setPresenceByUserId({});
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      const entries = await Promise.all(
        memberIds.map(async (userId) => {
          const status = await chatService.getPresenceStatus(userId, roomId);
          return [userId, status];
        }),
      );
      if (!cancelled) {
        setPresenceByUserId(Object.fromEntries(entries));
      }
    };

    void load();

    const onRefresh = (event) => {
      if (String(event?.detail?.chatId) === String(roomId)) {
        void load();
      }
    };

    window.addEventListener('webchat:presence-refresh', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('webchat:presence-refresh', onRefresh);
    };
  }, [enabled, roomId, memberIdsKey, memberIds]);

  return presenceByUserId;
}
