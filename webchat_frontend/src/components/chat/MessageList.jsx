import React, { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import MessageItem from './MessageItem';
import MessageUnreadSeparator from './MessageUnreadSeparator';

const HIGHLIGHT_MS = 2200;

const messageRowId = (message) => String(message?.id ?? message?._id ?? '');

const MessageList = ({
  messages,
  currentUserId,
  room = null,
  messagesEndRef,
  onReply,
  onOpenForward,
  onOpenForwardedProfile,
  openSeparatorIndex = null,
  liveBeforeMessageId = null,
  hideChannelReplyActions = false,
}) => {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const viewportRef = useRef(null);
  const contentRef = useRef(null);

  const scrollViewportToBottom = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.scrollTop = vp.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    scrollViewportToBottom();
  }, [messages, scrollViewportToBottom]);

  useEffect(() => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (!vp || !content) return;
    const ro = new ResizeObserver(() => {
      vp.scrollTop = vp.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const handleJumpToMessage = useCallback((messageId) => {
    if (messageId == null || messageId === '') return;
    const el = document.getElementById(`webchat-msg-${messageId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
    }, HIGHLIGHT_MS);
  }, []);

  return (
    <Box
      ref={viewportRef}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        p: 2,
        bgcolor: '#f5f5f5',
      }}
    >
      <div ref={contentRef}>
        {safeMessages.map((message, index) => {
          const mid = messageRowId(message);
          const showOpen = openSeparatorIndex === index;
          const showLive =
            liveBeforeMessageId != null &&
            liveBeforeMessageId !== '' &&
            liveBeforeMessageId === mid;
          const combined = showOpen && showLive;
          return (
            <Fragment key={mid || `idx-${index}`}>
              {combined && <MessageUnreadSeparator label="New messages" />}
              {!combined && showOpen && <MessageUnreadSeparator label="Unread messages" />}
              {!combined && showLive && <MessageUnreadSeparator label="New messages" />}
              <MessageItem
                message={message}
                currentUserId={currentUserId}
                room={room}
                onReply={onReply}
                onOpenForward={onOpenForward}
                onOpenForwardedProfile={onOpenForwardedProfile}
                onJumpToMessage={handleJumpToMessage}
                isHighlighted={String(highlightedMessageId) === String(message.id ?? message._id)}
                hideReplyActions={hideChannelReplyActions}
              />
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </Box>
  );
};

export default MessageList;

