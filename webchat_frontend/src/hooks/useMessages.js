import { useEffect, useRef, useState } from 'react';
import useChatStore from '../store/useChatStore';
import chatService from '../services/chatService';
import { useShallow } from 'zustand/react/shallow';
import { sendChatMessage, sendTypingEvent } from '../utils/websocket';
import { getAttachmentUploadErrorMessage } from '../utils/attachmentUploadErrors';
import { WEBCHAT_MESSAGES_MARKED_READ } from '../constants/chatEvents';
import { canPostInChannel } from '../utils/channelPermissions';

const useMessages = (currentChat) => {
  const { messages, setMessages } = useChatStore(
    useShallow((state) => ({
      messages: state.messages,
      setMessages: state.setMessages,
    }))
  );
  const setCurrentChat = useChatStore((state) => state.setCurrentChat);
  const setChats = useChatStore((state) => state.setChats);
  const upsertChat = useChatStore((state) => state.upsertChat);

  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false); // eslint-disable-line no-unused-vars
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const bootstrapRequestKeyRef = useRef(null);

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

    const loadMessages = async () => {
      if (!chatId) return;

      try {
        setLoading(true);
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
            if (!byId.has(mid)) byId.set(mid, m);
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
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [currentChat?.id]);

  const handleSendMessage = async () => {
    if (!currentChat || isSending) return;

    if (!canPostInChannel(currentChat)) return;

    const trimmedMessage = newMessage.trim();
    const hasText = trimmedMessage.length > 0;
    const hasAttachments = selectedAttachments.length > 0;
    if (!trimmedMessage && selectedAttachments.length === 0) return;

    if (!currentChat.id && hasAttachments) {
      setComposerError(
        'Send a text message first to start the chat. You can attach files in the next messages.'
      );
      return;
    }

    setComposerError('');

    const previousText = newMessage;
    const previousAttachments = [...selectedAttachments];
    const previousReply = replyToMessage;
    setNewMessage('');
    setSelectedAttachments([]);
    setReplyToMessage(null);

    try {
      setIsSending(true);
      let attachmentIds = [];

      if (hasAttachments) {
        console.log('Uploading attachments:', selectedAttachments.length);
        const uploaded = await chatService.uploadAttachments(currentChat.id, selectedAttachments);
        attachmentIds = uploaded.map((attachment) => attachment.id).filter(Boolean);
        console.log('Attachments uploaded, IDs:', attachmentIds);
      }

      if (!currentChat.id) {
        if (!bootstrapRequestKeyRef.current) {
          bootstrapRequestKeyRef.current =
            globalThis.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }
        const bootstrap = await chatService.bootstrapMessage({
          recipientUserId: currentChat.otherUser?.id,
          content: trimmedMessage,
          clientRequestKey: bootstrapRequestKeyRef.current
        });

        const latestChats = await chatService.getUserChats();
        setChats(latestChats);

        const createdChat = latestChats.find((chat) => chat.id === bootstrap.chatId);
        if (createdChat) {
          setCurrentChat(createdChat);
          upsertChat(createdChat);
        }
        if (bootstrap?.message) {
          setMessages([bootstrap.message]);
        }
        bootstrapRequestKeyRef.current = null;
      } else {
        const sent = sendChatMessage({
          chatId: currentChat.id,
          content: hasText ? trimmedMessage : null,
          attachmentIds,
          type: hasAttachments ? 'MIXED' : 'TEXT',
          replyToMessageId: replyToMessage?.id || null
        });
        if (!sent) {
          throw new Error('WebSocket is not connected');
        }
      }

      if (currentChat.id) {
        sendTypingEvent({ chatId: currentChat.id, typing: false });
      }
    } catch (error) {
      setNewMessage(previousText);
      setSelectedAttachments(previousAttachments);
      setReplyToMessage(previousReply);
      console.error('Failed to send message:', error);
      const isUploadFailure =
        previousAttachments.length > 0 &&
        error?.config?.url &&
        String(error.config.url).includes('/attachments');
      const message = isUploadFailure
        ? getAttachmentUploadErrorMessage(error, 'Could not upload the file. Please try again.')
        : error?.message === 'WebSocket is not connected'
          ? 'Not connected. Wait for the connection to recover, then try again.'
          : 'Could not send the message. Please try again.';
      setComposerError(message);
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return {
    messages,
    newMessage,
    setNewMessage,
    composerError,
    setComposerError,
    handleSendMessage,
    handleTyping,
    handleKeyPress,
    selectedAttachments,
    handleSelectAttachments,
    handleRemoveAttachment,
    messagesEndRef,
    replyToMessage,
    setReplyToMessage,
  };
};

export default useMessages;

