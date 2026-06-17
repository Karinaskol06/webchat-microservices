import React, { useCallback, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import StickyNoteMessage from './StickyNoteMessage';
import { parseRichPayload, serializePayload } from '../../utils/personalSpace';
import { clampStickyToContent, getStickyContentBounds } from '../../utils/stickyNoteLayout';
import chatService from '../../services/chatService';
import useChatStore from '../../store/useChatStore';

const PersonalSpaceStickyLayer = ({ messages, currentUserId, viewportRef, contentRef }) => {
  const updateMessageContent = useChatStore((s) => s.updateMessageContent);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const [dragPositions, setDragPositions] = useState({});

  const stickies = useMemo(
    () =>
      (Array.isArray(messages) ? messages : []).filter((m) => {
        const type = String(m.messageType || m.message_type || '').toUpperCase();
        return type === 'STICKY_NOTE';
      }),
    [messages],
  );

  const getBounds = useCallback(
    () => getStickyContentBounds(viewportRef?.current, contentRef?.current),
    [viewportRef, contentRef],
  );

  const persistSticky = useCallback(
    async (messageId, content) => {
      try {
        const updated = await chatService.editMessage(messageId, content);
        updateMessageContent(messageId, updated.content ?? content);
      } catch (e) {
        console.error('Failed to save sticky note', e);
      }
    },
    [updateMessageContent],
  );

  const handleDragMove = useCallback(
    (messageId, payload) => {
      const clamped = clampStickyToContent(
        Number(payload?.x) || 0,
        Number(payload?.y) || 0,
        getBounds(),
      );
      setDragPositions((prev) => ({
        ...prev,
        [String(messageId)]: clamped,
      }));
    },
    [getBounds],
  );

  const handleDragEnd = useCallback(
    (messageId, payload) => {
      const key = String(messageId);
      const clamped = clampStickyToContent(
        Number(payload?.x) || 0,
        Number(payload?.y) || 0,
        getBounds(),
      );
      const serialized = serializePayload({ ...payload, ...clamped });
      updateMessageContent(messageId, serialized);
      setDragPositions((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      void persistSticky(messageId, serialized);
    },
    [getBounds, persistSticky, updateMessageContent],
  );

  if (!stickies.length) return null;

  return (
    <Box
      aria-hidden={false}
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
        minHeight: 480,
      }}
    >
      {stickies.map((message) => {
        const { data } = parseRichPayload(message);
        const isOwn = Number(message.senderId ?? message.sender?.id) === Number(currentUserId);
        const messageId = message.id ?? message._id;
        const dragKey = String(messageId);
        const dragOverride = dragPositions[dragKey];
        const x = dragOverride?.x ?? (Number(data?.x) || 24);
        const y = dragOverride?.y ?? (Number(data?.y) || 24);
        const displayPayload = { ...data, x, y };

        return (
          <Box
            key={messageId}
            sx={{
              position: 'absolute',
              left: x,
              top: y,
              pointerEvents: 'auto',
            }}
          >
            <StickyNoteMessage
              messageId={messageId}
              payload={displayPayload}
              editable={isOwn}
              onUpdate={(content) => {
                updateMessageContent(messageId, content);
                void persistSticky(messageId, content);
              }}
              onDelete={
                isOwn
                  ? () =>
                      chatService
                        .deleteMessage(messageId)
                        .then(() => removeMessage(messageId))
                        .catch(console.error)
                  : undefined
              }
              floating
              viewportRef={viewportRef}
              contentRef={contentRef}
              onDragMove={(payload) => handleDragMove(messageId, payload)}
              onDragEnd={(payload) => handleDragEnd(messageId, payload)}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default PersonalSpaceStickyLayer;