import { useEffect, useRef, useState } from 'react';
import useChatStore from '../store/useChatStore';
import useAuthStore from '../store/useAuthStore';
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
  const user = useAuthStore((state) => state.user);

  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false); // eslint-disable-line no-unused-vars
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when chat changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentChat) return;

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
        // mark all received messages as read when opening chat
        try {
          await chatService.markAsRead(currentChat.id);
        } catch (e) {
          console.error('Failed to mark messages as read:', e);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [currentChat, setMessages]);

  const handleSendMessage = async () => {
    if (!currentChat) return;

    const trimmedMessage = newMessage.trim();
    const hasText = trimmedMessage.length > 0;
    const hasAttachments = selectedAttachments.length > 0;
    if (!trimmedMessage && selectedAttachments.length === 0) return;

    try {
      let attachmentIds = [];

      if (hasAttachments) {
        console.log('Uploading attachments:', selectedAttachments.length);
        const uploaded = await chatService.uploadAttachments(currentChat.id, selectedAttachments);
        attachmentIds = uploaded.map((attachment) => attachment.id).filter(Boolean);
        console.log('Attachments uploaded, IDs:', attachmentIds);
      }

      const sent = sendChatMessage({
        chatId: currentChat.id,
        content: hasText ? trimmedMessage : null,
        attachmentIds,
        senderId: user?.id,
        type: hasAttachments ? 'MIXED' : 'TEXT'
      });
      if (!sent) {
        throw new Error('WebSocket is not connected');
      }

      setNewMessage('');
      setSelectedAttachments([]);

      sendTypingEvent({ chatId: currentChat.id, typing: false, userId: user?.id });
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleTyping = () => {
    if (!currentChat) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    sendTypingEvent({ chatId: currentChat.id, typing: true, userId: user?.id });

    // Stops after 3 sec of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingEvent({ chatId: currentChat.id, typing: false, userId: user?.id });
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

