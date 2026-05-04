import { useEffect, useRef, useState } from 'react';
import useChatStore from '../store/useChatStore';
import chatService from '../services/chatService';
import { useShallow } from 'zustand/react/shallow';
import { sendChatMessage, sendTypingEvent } from '../utils/websocket';

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
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const bootstrapRequestKeyRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when chat changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentChat || !currentChat.id) return;

      try {
        setLoading(true);
        const data = await chatService.getMessages(currentChat.id);
        const messagesArray =
          (Array.isArray(data) && data) ||
          (Array.isArray(data?.content) && data.content) ||
          (Array.isArray(data?.messages) && data.messages) ||
          (Array.isArray(data?.data) && data.data) ||
          [];
        
        const sorted = [...messagesArray].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        setMessages(sorted);
        // Do not block UI on read receipt
        chatService.markAsRead(currentChat.id).catch((e) => {
          console.error('Failed to mark messages as read:', e);
        });
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [currentChat?.id, setMessages]);

  const handleSendMessage = async () => {
    if (!currentChat || isSending) return;

    const trimmedMessage = newMessage.trim();
    const hasText = trimmedMessage.length > 0;
    const hasAttachments = selectedAttachments.length > 0;
    if (!trimmedMessage && selectedAttachments.length === 0) return;

    const previousText = newMessage;
    const previousAttachments = [...selectedAttachments];
    setNewMessage('');
    setSelectedAttachments([]);

    try {
      setIsSending(true);
      let attachmentIds = [];

      if (!currentChat.id && hasAttachments) {
        throw new Error('Attachments are available after chat creation only');
      }

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
          clientRequestKey: bootstrapRequestKeyRef.current,
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
          type: hasAttachments ? 'MIXED' : 'TEXT'
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
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = () => {
    if (!currentChat?.id) return;

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
    const nextFiles = Array.from(files);
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
    handleSendMessage,
    handleTyping,
    handleKeyPress,
    selectedAttachments,
    handleSelectAttachments,
    handleRemoveAttachment,
    messagesEndRef,
  };
};

export default useMessages;

