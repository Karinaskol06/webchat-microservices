import { useEffect, useRef, useState } from 'react';
import useChatStore from '../store/useChatStore';
import chatService from '../services/chatService';
import { useShallow } from 'zustand/react/shallow';

const useMessages = (currentChat) => {
  const { messages, setMessages, addMessage } = useChatStore(
    useShallow((state) => ({
      messages: state.messages,
      setMessages: state.setMessages,
      addMessage: state.addMessage,
    }))
  );

  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false); // eslint-disable-line no-unused-vars
  const [typingTimeout, setTypingTimeout] = useState(null);
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
    if (!newMessage.trim() || !currentChat) return;

    try {
      const messageData = { content: newMessage };

      // Send message and get the response
      const sentMessage = await chatService.sendMessage(currentChat.id, messageData);

      if (sentMessage) {
        addMessage(sentMessage);
      }
      setNewMessage('');

      // Send typing indicator false after sending message
      chatService.sendTyping(currentChat.id, false);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleTyping = () => {
    if (!currentChat) return;

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    chatService.sendTyping(currentChat.id, true);

    // Stops after 3 sec of inactivity
    const timeout = setTimeout(() => {
      chatService.sendTyping(currentChat.id, false);
    }, 3000);

    setTypingTimeout(timeout);
  };

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
    messagesEndRef,
  };
};

export default useMessages;

