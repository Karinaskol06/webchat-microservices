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
import { Box, Typography } from '@mui/material';
import { chatColors, chatHideScrollbarSx, chatRadii } from '../../theme/chatDesignTokens';
import { CHAT_MESSAGE_ENTER_MS } from '../../theme/chatAnimations';
import MessageItem from './MessageItem';
import MessageUnreadSeparator from './MessageUnreadSeparator';
import PersonalSpaceStickyLayer from '../personalSpace/PersonalSpaceStickyLayer';
import { ChatAreaMetricsProvider } from '../../context/ChatAreaMetricsContext';
import { collectChatImageAttachments } from '../../utils/imageAttachments';
import { openImageLightbox } from '../../utils/openImageLightbox';
import { parseRichPayload } from '../../utils/personalSpace';
import { STICKY_NOTE_SIZE } from '../../utils/stickyNoteLayout';
import {
  isOptimisticMessageId,
  messageSendSignature,
} from '../../utils/messageOptimistic';
import { formatMessageDayLabel } from '../../utils/messageDate';
import { buildMessageDayMeta, useMessageScrollDateTag } from '../../hooks/useMessageScrollDateTag';
import useTranslation from '../../hooks/useTranslation';

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
    onOpenForwardedRoom,
    openSeparatorIndex = null,
    liveBeforeMessageId = null,
    scrollToMessageId = null,
    hideChannelReplyActions = false,
    inChatSearchQuery = '',
    inChatSearchMatches = [],
    activeInChatSearchMatch = null,
    onOpenEmojiSidebarForReaction,
    isPersonalSpace = false,
    messagesLoading = false,
  },
  ref,
) {
  const { t } = useTranslation();
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
  const seenMessageIdsRef = useRef(new Set());
  const hydratedRef = useRef(false);
  const prevMessagesRef = useRef([]);
  const [enteringMessageIds, setEnteringMessageIds] = useState(() => new Set());
  const formatDayLabel = useCallback(
    (timestamp) => formatMessageDayLabel(timestamp, t),
    [t],
  );
  const messagesWithDayMeta = useMemo(
    () => buildMessageDayMeta(safeMessages, formatDayLabel),
    [safeMessages, formatDayLabel],
  );
  const { scrollDateLabel, showScrollDate } =
    useMessageScrollDateTag(viewportRef, !isPersonalSpace);

  useEffect(() => {
    seenMessageIdsRef.current = new Set();
    hydratedRef.current = false;
    prevMessagesRef.current = [];
    setEnteringMessageIds(new Set());
  }, [chatId]);

  useLayoutEffect(() => {
    if (messagesLoading || hydratedRef.current) return;

    safeMessages.forEach((message) => {
      const id = messageRowId(message);
      if (id) seenMessageIdsRef.current.add(id);
    });
    hydratedRef.current = true;
    prevMessagesRef.current = safeMessages;
  }, [messagesLoading, safeMessages]);

  useLayoutEffect(() => {
    if (!hydratedRef.current || messagesLoading) return;

    const prevOptimisticSignatures = new Set(
      prevMessagesRef.current
        .filter((message) => isOptimisticMessageId(message.id ?? message._id))
        .map((message) => messageSendSignature(message))
        .filter(Boolean),
    );

    const newEnteringIds = [];
    safeMessages.forEach((message) => {
      const id = messageRowId(message);
      if (!id || seenMessageIdsRef.current.has(id)) return;

      const signature = messageSendSignature(message);
      if (
        !isOptimisticMessageId(id) &&
        signature &&
        prevOptimisticSignatures.has(signature)
      ) {
        seenMessageIdsRef.current.add(id);
        return;
      }

      newEnteringIds.push(id);
      seenMessageIdsRef.current.add(id);
    });

    prevMessagesRef.current = safeMessages;

    if (newEnteringIds.length === 0) return undefined;

    setEnteringMessageIds((current) => new Set([...current, ...newEnteringIds]));
    const timer = window.setTimeout(() => {
      setEnteringMessageIds((current) => {
        const next = new Set(current);
        newEnteringIds.forEach((id) => next.delete(id));
        return next;
      });
    }, CHAT_MESSAGE_ENTER_MS + 40);

    return () => window.clearTimeout(timer);
  }, [messagesLoading, safeMessages]);

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
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        p: 2,
        bgcolor: chatColors.conversationBg,
        ...chatHideScrollbarSx,
      }}
    >
      {!isPersonalSpace && scrollDateLabel ? (
        <Box
          aria-live="polite"
          aria-atomic="true"
          sx={{
            position: 'absolute',
            top: 10,
            left: 0,
            right: 0,
            zIndex: 4,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: showScrollDate ? 1 : 0,
            transform: showScrollDate ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
              transform: 'none',
            },
          }}
        >
          <Typography
            variant="caption"
            component="span"
            sx={{
              px: 1.5,
              py: 0.4,
              borderRadius: chatRadii.pill,
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(8px)',
              color: chatColors.textSecondary,
              fontWeight: 600,
              letterSpacing: 0.02,
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.18)',
            }}
          >
            {scrollDateLabel}
          </Typography>
        </Box>
      ) : null}
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
        {messagesWithDayMeta.map(({ message, showDaySeparator, dayKey, dayLabel, separatorLabel }, index) => {
          const mid = messageRowId(message);
          const showOpen = openSeparatorIndex === index;
          const showLive =
            liveBeforeMessageId != null &&
            liveBeforeMessageId !== '' &&
            liveBeforeMessageId === mid;
          const combined = showOpen && showLive;
          return (
            <Fragment key={mid || `idx-${index}`}>
              {showDaySeparator ? (
                <MessageUnreadSeparator
                  variant="date"
                  label={separatorLabel}
                  dayKey={dayKey}
                />
              ) : null}
              {combined && <MessageUnreadSeparator label={t('message.unreadSeparator.new')} />}
              {!combined && showOpen && <MessageUnreadSeparator label={t('message.unreadSeparator')} />}
              {!combined && showLive && <MessageUnreadSeparator label={t('message.unreadSeparator.new')} />}
              <Box
                data-message-day-key={dayKey ?? undefined}
                data-message-day-label={dayLabel ?? undefined}
              >
                <MessageItem
                message={message}
                currentUserId={currentUserId}
                room={room}
                isEntering={enteringMessageIds.has(mid)}
                onReply={onReply}
                onOpenForward={onOpenForward}
                onOpenForwardedProfile={onOpenForwardedProfile}
                onOpenForwardedRoom={onOpenForwardedRoom}
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
              </Box>
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
