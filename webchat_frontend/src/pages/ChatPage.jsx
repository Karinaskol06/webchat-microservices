import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
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
import UserSearchDialog from '../components/chat/UserSearchDialog';
import useWebSocket from '../hooks/useWebSocket';
import useMessages from '../hooks/useMessages';
import useTyping from '../hooks/useTyping'; 
import { useShallow } from 'zustand/react/shallow';
import contactsService from '../services/contactsService';

const ChatPage = () => {
  const { currentChat, messages } = useChatStore(
    useShallow(state => ({
      currentChat: state.currentChat,
      messages: state.messages
    }))
  );

  const { user } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState(null);
  const [emojiSidebarOpen, setEmojiSidebarOpen] = useState(false);
  const [contactStatus, setContactStatus] = useState(null);
  const [contactActionLoading, setContactActionLoading] = useState(false);
  const afkTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const isAfkRef = useRef(false);
  
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
    selectedAttachments,
    handleSelectAttachments,
    handleRemoveAttachment,
    messagesEndRef,
  } = useMessages(currentChat);

  useWebSocket(user, currentChat?.id, user?.id);

  const clearPresenceTimers = useCallback(() => {
    if (afkTimeoutRef.current) {
      clearTimeout(afkTimeoutRef.current);
      afkTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const markActiveInChat = useCallback(async () => {
    if (!currentChat?.id) return;
    if (document.hidden) return;
    try {
      await chatService.enterChat(currentChat.id);
      isAfkRef.current = false;
    } catch (error) {
      console.debug('Failed to mark active in chat', error);
    }
  }, [currentChat?.id]);

  const markAfkInChat = useCallback(async () => {
    if (!currentChat?.id || isAfkRef.current) return;
    try {
      await chatService.markAfk(currentChat.id);
      isAfkRef.current = true;
    } catch (error) {
      console.debug('Failed to mark AFK', error);
    }
  }, [currentChat?.id]);

  const resetAfkDeadline = useCallback(() => {
    if (!currentChat?.id) return;
    if (afkTimeoutRef.current) {
      clearTimeout(afkTimeoutRef.current);
    }
    afkTimeoutRef.current = setTimeout(() => {
      markAfkInChat();
    }, 30000);
  }, [currentChat?.id, markAfkInChat]);

  const handleTypingWithPresence = useCallback(() => {
    handleTyping();
    if (currentChat?.id) {
      markActiveInChat().finally(() => {
        resetAfkDeadline();
      });
    }
  }, [handleTyping, currentChat?.id, markActiveInChat, resetAfkDeadline]);

  useEffect(() => {
    if (!currentChat?.id) {
      clearPresenceTimers();
      isAfkRef.current = false;
      return;
    }

    const onVisibilityChange = () => {
      if (!currentChat?.id) return;
      if (document.hidden) {
        markAfkInChat();
      } else {
        markActiveInChat().finally(() => {
          resetAfkDeadline();
        });
      }
    };

    const startPresenceLoop = async () => {
      await markActiveInChat();
      resetAfkDeadline();
      heartbeatIntervalRef.current = setInterval(() => {
        if (!document.hidden && !isAfkRef.current && currentChat?.id) {
          chatService.heartbeatChat(currentChat.id).catch(() => {});
        }
      }, 10000);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    startPresenceLoop();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearPresenceTimers();
      if (currentChat?.id) {
        chatService.markAfk(currentChat.id).catch(() => {});
      }
      isAfkRef.current = false;
    };
  }, [currentChat?.id, clearPresenceTimers, markActiveInChat, markAfkInChat, resetAfkDeadline]);

  // Show emoji sidebar only when chat is open
  useEffect(() => {
    setEmojiSidebarOpen(Boolean(currentChat));
  }, [currentChat]);

  // Fetch presence status for the interlocutor
  useEffect(() => {
    if (!currentChat?.id || !otherUser?.id) {
      setPresenceStatus(null);
      return;
    }
    
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
    const intervalId = setInterval(fetchPresence, 7000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [currentChat?.id, otherUser?.id]);

  useEffect(() => {
    const loadContactStatus = async () => {
      if (!currentChat?.id || !otherUser?.id) {
        setContactStatus(null);
        return;
      }
      try {
        const status = await contactsService.getStatus(otherUser.id, user?.id);
        setContactStatus(status);
      } catch (error) {
        console.error('Failed to fetch contact status:', error);
        setContactStatus(null);
      }
    };

    loadContactStatus();
  }, [currentChat?.id, otherUser?.id, user?.id]);

  const handleSelectUserForNewChat = (selectedUser) => {
    if (!selectedUser) return;
    const existingChat = useChatStore
      .getState()
      .chats.find((chat) => Number(chat.otherUser?.id) === Number(selectedUser.id));
    if (existingChat) {
      useChatStore.getState().setCurrentChat(existingChat);
      return;
    }
    useChatStore.getState().setCurrentChat({
      id: null,
      type: 'PRIVATE',
      otherUser: {
        id: selectedUser.id,
        username: selectedUser.username,
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        profilePicture: selectedUser.avatar || null,
      },
      lastMessage: null,
      unreadCount: 0,
    });
  };

  const handleAcceptContact = async () => {
    const requestId = contactStatus?.prompt?.requestId;
    if (!requestId) return;
    try {
      setContactActionLoading(true);
      await contactsService.acceptRequest(requestId, user?.id);
      const refreshed = await contactsService.getStatus(otherUser?.id, user?.id);
      setContactStatus(refreshed);
    } finally {
      setContactActionLoading(false);
    }
  };

  const handleDeclineContact = async () => {
    const requestId = contactStatus?.prompt?.requestId;
    if (!requestId) return;
    try {
      setContactActionLoading(true);
      await contactsService.declineRequest(requestId, user?.id);
      const refreshed = await contactsService.getStatus(otherUser?.id, user?.id);
      setContactStatus(refreshed);
    } finally {
      setContactActionLoading(false);
    }
  };

  // UI Rendering block
  if (!currentChat) {
    return (
      <Box sx={{ display: 'flex', height: '100%', width: '100%', minHeight: 0 }}>
        <Box sx={{ width: 360, maxWidth: 420, borderRight: 1, borderColor: 'divider' }}>
          <ChatList onFindUsers={() => setUserSearchOpen(true)} />
        </Box>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Choose a chat to start messaging
          </Typography>
        </Box>
        <UserSearchDialog
          open={userSearchOpen}
          onClose={() => setUserSearchOpen(false)}
          onSelectUser={handleSelectUserForNewChat}
          currentUserId={user?.id}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', minHeight: 0 }}>
      <Box sx={{ width: 360, maxWidth: 420, borderRight: 1, borderColor: 'divider' }}>
        <ChatList onFindUsers={() => setUserSearchOpen(true)} />
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

        {contactStatus?.state === 'PENDING' && Number(contactStatus?.prompt?.fromUserId) === Number(otherUser?.id) && (
          <Alert
            severity="info"
            action={
              <>
                <Button color="inherit" size="small" onClick={handleAcceptContact} disabled={contactActionLoading}>
                  Yes
                </Button>
                <Button color="inherit" size="small" onClick={handleDeclineContact} disabled={contactActionLoading}>
                  No
                </Button>
              </>
            }
          >
            Add to contacts?
          </Alert>
        )}

        <MessageList
          messages={messages}
          currentUserId={user?.id}
          messagesEndRef={messagesEndRef}
        />

        <MessageInput
          value={newMessage}
          onChange={setNewMessage}
          onSend={handleSendMessage}
          onTyping={handleTypingWithPresence}
          onKeyPress={handleKeyPress}
          attachments={selectedAttachments}
          onSelectAttachments={handleSelectAttachments}
          onRemoveAttachment={handleRemoveAttachment}
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

      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
        onSelectUser={handleSelectUserForNewChat}
        currentUserId={user?.id}
      />
    </Box>
  );
};

export default ChatPage;