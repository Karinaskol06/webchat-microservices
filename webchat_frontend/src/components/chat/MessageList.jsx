import React, {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box } from '@mui/material';
import { chatColors, chatHideScrollbarSx } from '../../theme/chatDesignTokens';
import MessageItem from './MessageItem';
import MessageUnreadSeparator from './MessageUnreadSeparator';
import PersonalSpaceStickyLayer from '../personalSpace/PersonalSpaceStickyLayer';
import { ChatAreaMetricsProvider } from '../../context/ChatAreaMetricsContext';
import { collectChatImageAttachments } from '../../utils/imageAttachments';
import { openImageLightbox } from '../../utils/openImageLightbox';
import { parseRichPayload } from '../../utils/personalSpace';
import { STICKY_NOTE_SIZE } from '../../utils/stickyNoteLayout';

const HIGHLIGHT_MS = 2200;

const messageRowId = (message) => String(message?.id ?? message?._id ?? '');

const MessageList = forwardRef(function MessageList(
  {
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
    isPersonalSpace = false,
  },
  ref,
) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const chatImages = useMemo(
    () => collectChatImageAttachments(safeMessages),
    [safeMessages],
  );
  const handleOpenImage = useCallback(
    (attachment) => openImageLightbox(attachment, chatImages),
    [chatImages],
  );
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const scrolledToUnreadRef = useRef(false);
  const scrollVisitKeyRef = useRef('');
  const tailSignatureRef = useRef({ count: 0, lastId: null });

  const isNearBottom = useCallback((threshold = 96) => {
    const vp = viewportRef.current;
    if (!vp) return true;
    return vp.scrollHeight - vp.scrollTop - vp.clientHeight <= threshold;
  }, []);

  const scrollViewportToBottom = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.scrollTop = vp.scrollHeight;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getStickyPlacement: () => {
        const vp = viewportRef.current;
        if (!vp) return { x: 40, y: 40 };
        const pad = 24;
        const availW = Math.max(1, vp.clientWidth - STICKY_NOTE_SIZE.width - pad * 2);
        const availH = Math.max(1, vp.clientHeight - STICKY_NOTE_SIZE.height - pad * 2);
        return {
          x: vp.scrollLeft + pad + Math.floor(Math.random() * availW),
          y: vp.scrollTop + pad + Math.floor(Math.random() * availH),
        };
      },
      revealSticky: (message) => {
        const { data } = parseRichPayload(message);
        const y = Number(data?.y) || 0;
        const vp = viewportRef.current;
        if (!vp) return;
        const top = y - 16;
        const bottom = y + STICKY_NOTE_SIZE.height + 16;
        const viewTop = vp.scrollTop;
        const viewBottom = vp.scrollTop + vp.clientHeight;
        if (top < viewTop || bottom > viewBottom) {
          vp.scrollTop = Math.max(0, y - 24);
        }
      },
    }),
    [],
  );

  const searchActive = Boolean(String(inChatSearchQuery || '').trim());

  useEffect(() => {
    const key = `${chatId ?? ''}:${scrollToMessageId ?? ''}`;
    if (scrollVisitKeyRef.current !== key) {
      scrollVisitKeyRef.current = key;
      scrolledToUnreadRef.current = false;
    }
  }, [chatId, scrollToMessageId]);

  useLayoutEffect(() => {
    if (searchActive || isPersonalSpace) return;

    const count = safeMessages.length;
    const lastId = count > 0 ? messageRowId(safeMessages[count - 1]) : null;
    const prev = tailSignatureRef.current;
    const appended =
      count > prev.count ||
      (lastId != null && lastId !== prev.lastId && count >= prev.count);
    tailSignatureRef.current = { count, lastId };

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

    if (appended && !unreadTargetId) {
      scrollViewportToBottom();
    }
  }, [messages, scrollToMessageId, searchActive, scrollViewportToBottom, isPersonalSpace, safeMessages]);

  useEffect(() => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (!vp || !content) return;
    const ro = new ResizeObserver(() => {
      if (searchActive || isPersonalSpace) return;
      if (scrollToMessageId && !scrolledToUnreadRef.current) return;
      if (!isNearBottom()) return;
      vp.scrollTop = vp.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [searchActive, scrollToMessageId, isPersonalSpace, isNearBottom]);

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
        <div
          ref={contentRef}
          style={{ position: 'relative', minHeight: isPersonalSpace ? 520 : undefined }}
        >
        {isPersonalSpace ? (
          <PersonalSpaceStickyLayer
            messages={safeMessages}
            currentUserId={currentUserId}
            viewportRef={viewportRef}
            contentRef={contentRef}
          />
        ) : null}
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
                isPersonalSpace={isPersonalSpace}
                onOpenImage={handleOpenImage}
              />
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      </ChatAreaMetricsProvider>
    </Box>
  );
});

export default MessageList;
