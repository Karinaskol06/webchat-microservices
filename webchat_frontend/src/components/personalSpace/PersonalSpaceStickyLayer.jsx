import React, { useCallback, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import StickyNoteMessage from './StickyNoteMessage';
import { parseRichPayload } from '../../utils/personalSpace';
import chatService from '../../services/chatService';
import useChatStore from '../../store/useChatStore';

const PersonalSpaceStickyLayer = ({ messages, currentUserId }) => {
  const layerRef = useRef(null);
  const updateMessageContent = useChatStore((s) => s.updateMessageContent);
  const removeMessage = useChatStore((s) => s.removeMessage);

  const stickies = useMemo(
    () =>
      (Array.isArray(messages) ? messages : []).filter((m) => {
        const type = String(m.messageType || m.message_type || '').toUpperCase();
        return type === 'STICKY_NOTE';
      }),
    [messages],
  );

  const persistSticky = useCallback(
    async (messageId, content, { live } = {}) => {
      if (live) {
        updateMessageContent(messageId, content);
        return;
      }
      try {
        const updated = await chatService.editMessage(messageId, content);
        updateMessageContent(messageId, updated.content ?? content);
      } catch (e) {
        console.error('Failed to save sticky position', e);
      }
    },
    [updateMessageContent],
  );

  if (!stickies.length) return null;

  return (
    <Box
      ref={layerRef}
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
        const x = Number(data?.x) || 24;
        const y = Number(data?.y) || 24;
        const messageId = message.id ?? message._id;

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
              payload={data}
              editable={isOwn}
              onUpdate={(content) => persistSticky(messageId, content)}
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
              onDragEnd={(content, opts) => persistSticky(messageId, content, opts)}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default PersonalSpaceStickyLayer;
