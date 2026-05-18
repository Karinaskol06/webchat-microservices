import React, { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { chatColors, chatHideScrollbarSx } from '../../theme/chatDesignTokens';
import MessageItem from './MessageItem';
import MessageUnreadSeparator from './MessageUnreadSeparator';
import { ChatAreaMetricsProvider } from '../../context/ChatAreaMetricsContext';

const HIGHLIGHT_MS = 2200;

const messageRowId = (message) => String(message?.id ?? message?._id ?? '');

const MessageList = ({
  messages,
  currentUserId,
  room = null,
  chatId = null,
  messagesEndRef,
  onReply,
  onOpenForward,
  onOpenForwardedProfile,
  openSeparatorIndex = null,
  liveBeforeMessageId = null,
  scrollToMessageId = null,
  hideChannelReplyActions = false,
  inChatSearchQuery = '',
  inChatSearchMatches = [],
  activeInChatSearchMatch = null,
  onOpenEmojiSidebarForReaction,
}) => {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const scrolledToUnreadRef = useRef(false);
  const scrollVisitKeyRef = useRef('');

  const scrollViewportToBottom = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.scrollTop = vp.scrollHeight;
  }, []);

  const searchActive = Boolean(String(inChatSearchQuery || '').trim());

  useEffect(() => {
    const key = `${chatId ?? ''}:${scrollToMessageId ?? ''}`;
    if (scrollVisitKeyRef.current !== key) {
      scrollVisitKeyRef.current = key;
      scrolledToUnreadRef.current = false;
    }
  }, [chatId, scrollToMessageId]);

  useLayoutEffect(() => {
    if (searchActive) return;

    const unreadTargetId =
      scrollToMessageId != null && scrollToMessageId !== ''
        ? String(scrollToMessageId)
        : null;

    if (unreadTargetId && !scrolledToUnreadRef.current) {
      const el = document.getElementById(`webchat-msg-${unreadTargetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
        scrolledToUnreadRef.current = true;
        return;
      }
    }

    if (!unreadTargetId) {
      scrollViewportToBottom();
    }
  }, [messages, scrollToMessageId, searchActive, scrollViewportToBottom]);

  useEffect(() => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (!vp || !content) return;
    const ro = new ResizeObserver(() => {
      if (searchActive) return;
      if (scrollToMessageId && !scrolledToUnreadRef.current) return;
      vp.scrollTop = vp.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [searchActive, scrollToMessageId]);

  useEffect(() => {
    if (!activeInChatSearchMatch?.messageId) return;
    const el = document.getElementById(`webchat-msg-${activeInChatSearchMatch.messageId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(activeInChatSearchMatch.messageId);
  }, [activeInChatSearchMatch]);

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
        bgcolor: chatColors.conversationBg,
        ...chatHideScrollbarSx,
      }}
    >
      <ChatAreaMetricsProvider viewportRef={viewportRef}>
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
                isHighlighted={
                  String(highlightedMessageId) === String(message.id ?? message._id) ||
                  (activeInChatSearchMatch != null &&
                    String(activeInChatSearchMatch.messageId) ===
                      String(message.id ?? message._id))
                }
                hideReplyActions={hideChannelReplyActions}
                inChatSearchQuery={inChatSearchQuery}
                inChatSearchMatches={inChatSearchMatches}
                activeInChatSearchMatch={activeInChatSearchMatch}
                onOpenEmojiSidebarForReaction={onOpenEmojiSidebarForReaction}
              />
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      </ChatAreaMetricsProvider>
    </Box>
  );
};

export default MessageList;
