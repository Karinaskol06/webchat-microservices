import { useEffect, useRef, useState } from 'react';
import useChatStore from '../store/useChatStore';
import chatService from '../services/chatService';
import { useShallow } from 'zustand/react/shallow';
import { ensureSendChatMessage, sendTypingEvent } from '../utils/websocket';
import { getAttachmentUploadErrorMessage } from '../utils/attachmentUploadErrors';
import { isChatAttachmentUploadUrl, validateAttachmentFiles } from '../utils/attachmentConstraints';
import { WEBCHAT_CHAT_CREATED, WEBCHAT_MESSAGES_MARKED_READ } from '../constants/chatEvents';
import { canPostInChannel } from '../utils/channelPermissions';
import { parsePrivateMessageBlockedError, parseUserBanError } from '../utils/userBanError';
import { createOptimisticMessageId } from '../utils/messageOptimistic';
import useAuthStore from '../store/useAuthStore';
import useTranslation from './useTranslation';

const useMessages = (currentChat, composerRef) => {
  const { t } = useTranslation();
  const { messages, setMessages } = useChatStore(
    useShallow((state) => ({
      messages: state.messages,
      setMessages: state.setMessages,
    }))
  );
  const setCurrentChat = useChatStore((state) => state.setCurrentChat);
  const upsertChat = useChatStore((state) => state.upsertChat);
  const user = useAuthStore((state) => state.user);

  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesLoadGenerationRef = useRef(0);
  // Load messages when chat changes
  useEffect(() => {
    setReplyToMessage(null);
  }, [currentChat?.id]);

  useEffect(() => {
    if (currentChat && !canPostInChannel(currentChat)) {
      setReplyToMessage(null);
    }
  }, [
    currentChat?.id,
    currentChat?.type,
    currentChat?.isCurrentUserChannelCreator,
    currentChat?.isCurrentUserChannelAdmin,
  ]);

  useEffect(() => {
    const chatId = currentChat?.id;
    let cancelled = false;

    if (!chatId) {
      setMessages([]);
      setMessagesLoading(false);
      return undefined;
    }

    const loadGeneration = ++messagesLoadGenerationRef.current;
    setMessagesLoading(true);

    const loadMessages = async () => {
      try {
        const data = await chatService.getMessages(chatId);
        if (cancelled) return;

        const messagesArray =
          (Array.isArray(data) && data) ||
          (Array.isArray(data?.content) && data.content) ||
          (Array.isArray(data?.messages) && data.messages) ||
          (Array.isArray(data?.data) && data.data) ||
          [];

        const sorted = [...messagesArray].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Merge with any messages already in state (e.g. forwarded via WebSocket before this
        // fetch finished) so history load does not wipe them.
        const normalize = useChatStore.getState().normalizeMessage;
        useChatStore.setState((state) => {
          if (String(state.currentChat?.id) !== String(chatId)) return state;
          const byId = new Map(
            sorted.map((m) => [String(m.id ?? m._id), normalize(m)])
          );
          for (const m of state.messages) {
            const mid = String(m.id ?? m._id);
            if (byId.has(mid)) continue;
            const msgChatId = m.chatId ?? m.chat_id;
            if (msgChatId != null && String(msgChatId) !== String(chatId)) continue;
            byId.set(mid, normalize(m));
          }
          const merged = [...byId.values()].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
          return { messages: merged };
        });

        // Do not block UI on read receipt
        chatService
          .markAsRead(chatId)
          .then(() => {
            window.dispatchEvent(
              new CustomEvent(WEBCHAT_MESSAGES_MARKED_READ, { detail: { chatId } }),
            );
          })
          .catch((e) => {
            console.error('Failed to mark messages as read:', e);
          });
      } catch (error) {
        console.error('Failed to load messages:', error);
        const status = error?.response?.status;
        useChatStore.setState((state) => {
          if (String(state.currentChat?.id) !== String(chatId)) {
            return state;
          }
          if (status === 403 || status === 404) {
            return { messages: [], currentChat: null };
          }
          return { messages: [] };
        });
      } finally {
        if (
          !cancelled &&
          loadGeneration === messagesLoadGenerationRef.current
        ) {
          setMessagesLoading(false);
        }
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [currentChat?.id, setMessages]);

  const handleSendMessage = async (messageText) => {
    if (!currentChat) return;

    const trimmedMessage = String(messageText ?? '').trim();
    const hasText = trimmedMessage.length > 0;
    const hasAttachments = selectedAttachments.length > 0;
    if (!hasText && !hasAttachments) return;

    if (isSending && hasAttachments) return;

    if (currentChat.messagingBlocked) {
      setComposerError(t('errors.composer.cannotMessageUser'));
      return;
    }

    if (!canPostInChannel(currentChat)) return;

    const previousText = String(messageText ?? '');
    const previousAttachments = [...selectedAttachments];
    const previousReply = replyToMessage;
    const isNewPrivateChat = !currentChat.id && String(currentChat.type || '').toUpperCase() === 'PRIVATE';

    if (!currentChat.id && hasAttachments) {
      setComposerError(
        'Send a text message first to start the chat. You can attach files in the next messages.'
      );
      return;
    }

    if (hasAttachments) {
      const validation = validateAttachmentFiles(previousAttachments);
      if (!validation.ok) {
        setComposerError(validation.message);
        return;
      }
    }

    const reportSendFailure = (error, optimisticId) => {
      if (optimisticId) {
        useChatStore.getState().removeMessage(optimisticId);
      }
      composerRef?.current?.setDraft(previousText);
      setSelectedAttachments(previousAttachments);
      setReplyToMessage(previousReply);
      const userBan = parseUserBanError(error);
      const privateMessageBlocked = parsePrivateMessageBlockedError(error, { isNewPrivateChat });
      const isUploadFailure =
        previousAttachments.length > 0 &&
        isChatAttachmentUploadUrl(error?.config?.url);
      const message = privateMessageBlocked
        ? t('errors.composer.cannotMessageUser')
        : userBan?.message
          ? userBan.message
          : isUploadFailure
            ? getAttachmentUploadErrorMessage(error, t('errors.composer.upload'))
            : error?.message === 'WebSocket is not connected'
              ? t('errors.composer.notConnected')
              : t('errors.composer.send');
      if (!privateMessageBlocked && !userBan) {
        console.error('Failed to send message:', error);
      }
      if (privateMessageBlocked) {
        setCurrentChat({ ...currentChat, messagingBlocked: true });
      }
      setComposerError(message);
    };

    // Existing chat, text-only: optimistic UI immediately; do not block the composer.
    if (currentChat.id && hasText && !hasAttachments) {
      setComposerError('');
      setReplyToMessage(null);
      const activeChatId = currentChat.id;
      const optimisticId = createOptimisticMessageId();
      useChatStore.getState().addMessage({
        id: optimisticId,
        chatId: String(activeChatId),
        content: trimmedMessage,
        messageType: 'TEXT',
        timestamp: new Date().toISOString(),
        senderId: user?.id,
        sender: user,
        attachments: [],
        replyToMessageId: previousReply?.id || null,
      });

      void ensureSendChatMessage({
        chatId: activeChatId,
        content: trimmedMessage,
        attachmentIds: [],
        type: 'TEXT',
        replyToMessageId: previousReply?.id || null,
      })
        .then(() => {
          sendTypingEvent({ chatId: activeChatId, typing: false });
        })
        .catch((error) => {
          reportSendFailure(error, optimisticId);
        });
      return;
    }

    setComposerError('');
    setSelectedAttachments([]);
    setReplyToMessage(null);

    try {
      setIsSending(true);
      let attachmentIds = [];
      let activeChatId = currentChat.id;

      if (hasAttachments) {
        const uploaded = await chatService.uploadAttachments(currentChat.id, previousAttachments);
        attachmentIds = uploaded.map((attachment) => attachment.id).filter(Boolean);
      }

      if (!currentChat.id) {
        const otherUserId = currentChat.otherUser?.id;
        if (!otherUserId) {
          throw new Error('Recipient is required to start a chat');
        }

        const createdChat = await chatService.createPrivateChat({ otherUserId });
        activeChatId = createdChat.id;
        setCurrentChat(createdChat);
        upsertChat(createdChat);
        window.dispatchEvent(
          new CustomEvent(WEBCHAT_CHAT_CREATED, { detail: { chat: createdChat } }),
        );

        await ensureSendChatMessage({
          chatId: activeChatId,
          content: hasText ? trimmedMessage : null,
          attachmentIds,
          type: hasAttachments ? 'MIXED' : 'TEXT',
          replyToMessageId: previousReply?.id || null,
        });
      } else {
        await ensureSendChatMessage({
          chatId: currentChat.id,
          content: hasText ? trimmedMessage : null,
          attachmentIds,
          type: hasAttachments ? 'MIXED' : 'TEXT',
          replyToMessageId: previousReply?.id || null,
        });
      }

      if (activeChatId) {
        sendTypingEvent({ chatId: activeChatId, typing: false });
      }
    } catch (error) {
      reportSendFailure(error, null);
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = () => {
    if (!currentChat?.id) return;
    if (!canPostInChannel(currentChat)) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    sendTypingEvent({ chatId: currentChat.id, typing: true });

    // Stops after 3 sec of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingEvent({ chatId: currentChat.id, typing: false });
    }, 3000);
  };

  const handleSelectAttachments = (files) => {
    if (!files || files.length === 0) return;
    if (!canPostInChannel(currentChat)) return;

    const nextFiles = Array.from(files);
    const validation = validateAttachmentFiles(nextFiles);
    if (!validation.ok) {
      setComposerError(validation.message);
      return;
    }

    setComposerError('');
    setSelectedAttachments((prev) => [...prev, ...nextFiles]);
  };

  const handleRemoveAttachment = (index) => {
    setSelectedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, []);

  return {
    messages,
    composerError,
    setComposerError,
    handleSendMessage,
    handleTyping,
    selectedAttachments,
    handleSelectAttachments,
    handleRemoveAttachment,
    messagesEndRef,
    replyToMessage,
    setReplyToMessage,
    messagesLoading,
  };
};

export default useMessages;

