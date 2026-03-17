import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
} from '@mui/material';
import useChatStore from '../store/useChatStore';
import useAuthStore from '../store/useAuthStore';
import chatService from '../services/chatService';
import ChatList from '../components/chat/ChatList';
import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';
import EmojiSidebar from '../components/chat/EmojiSidebar';
import UserProfileDialog from '../components/user/UserProfileDialog';
import useWebSocket from '../hooks/useWebSocket';
import useMessages from '../hooks/useMessages';
import useTyping from '../hooks/useTyping'; 
import { useShallow } from 'zustand/react/shallow';

const ChatPage = () => {
  const { currentChat, messages } = useChatStore(
    useShallow(state => ({
      currentChat: state.currentChat,
      messages: state.messages
    }))
  );

  const { user } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState(null);
  const [emojiSidebarOpen, setEmojiSidebarOpen] = useState(false);
  
  const otherUser =
    currentChat?.otherUser ||
    messages.find((m) => m.sender && m.sender.id !== user?.id)?.sender ||
    null;
  
  // Use the typing hook instead of direct store access
  const { isOtherUserTyping } = useTyping(currentChat, otherUser);

  const {
    newMessage,
    setNewMessage,
    handleSendMessage,
    handleTyping,
    handleKeyPress,
    messagesEndRef,
  } = useMessages(currentChat);

  useWebSocket(user, currentChat?.id, user?.id);

  // Show emoji sidebar only when chat is open
  useEffect(() => {
    setEmojiSidebarOpen(Boolean(currentChat));
  }, [currentChat]);

  // Fetch presence status for the interlocutor
  useEffect(() => {
    if (!currentChat || !otherUser) return;
    
    let cancelled = false;

    const fetchPresence = async () => {
      try {
        const status = await chatService.getPresenceStatus(
          otherUser.id,
          currentChat.id
        );
        if (!cancelled && status) {
          setPresenceStatus(status);
        }
      } catch (error) {
        console.error('Failed to fetch presence:', error);
      }
    };

    // Initial fetch
    fetchPresence();
    
    // Set up interval for periodic updates
    const intervalId = setInterval(fetchPresence, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [currentChat, otherUser]);

  // UI Rendering block
  if (!currentChat) {
    return (
      <Box sx={{ display: 'flex', height: '100%', width: '100%', minHeight: 0 }}>
        <Box sx={{ width: 360, maxWidth: 420, borderRight: 1, borderColor: 'divider' }}>
          <ChatList />
        </Box>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Choose a chat to start messaging
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', minHeight: 0 }}>
      <Box sx={{ width: 360, maxWidth: 420, borderRight: 1, borderColor: 'divider' }}>
        <ChatList />
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Paper sx={{ p: 2, borderRadius: 0 }}>
          <ChatHeader
            otherUser={otherUser}
            presenceStatus={presenceStatus}
            isTyping={isOtherUserTyping} 
            emojiSidebarOpen={emojiSidebarOpen}
            onOpenProfile={() => setProfileOpen(true)}
            onShowEmojiSidebar={() => setEmojiSidebarOpen(true)}
          />
        </Paper>

        <Divider />

        <MessageList
          messages={messages}
          currentUserId={user?.id}
          messagesEndRef={messagesEndRef}
        />

        <MessageInput
          value={newMessage}
          onChange={setNewMessage}
          onSend={handleSendMessage}
          onTyping={handleTyping}
          onKeyPress={handleKeyPress}
          emojiSidebarOpen={emojiSidebarOpen}
          onToggleEmojiSidebar={() => setEmojiSidebarOpen((prev) => !prev)}
        />

        <UserProfileDialog
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={otherUser}
        />
      </Box>

      {emojiSidebarOpen && (
        <EmojiSidebar
          onClose={() => setEmojiSidebarOpen(false)}
          onEmojiClick={(emoji) => setNewMessage((prev) => `${prev}${emoji}`)}
        />
      )}
    </Box>
  );
};

export default ChatPage;