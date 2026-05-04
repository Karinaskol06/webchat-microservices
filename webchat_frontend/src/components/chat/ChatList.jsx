import React, { useEffect, useState } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Badge,
  Box,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import useChatStore from '../../store/useChatStore';
import chatService from '../../services/chatService';
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import { derivePresenceState } from '../../utils/presence';

const ChatList = ({ onFindUsers, onSelectChat }) => {
  const { user } = useAuthStore();
  
  // Using selectors with shallow comparison
  const chats = useChatStore(useShallow(state => state.chats));
  const isLoading = useChatStore(state => state.isLoadingChats);
  
  // Getting actions
  const setChats = useChatStore(state => state.setChats);
  const setCurrentChat = useChatStore(state => state.setCurrentChat);
  const setLoadingChats = useChatStore(state => state.setLoadingChats);
  const setError = useChatStore(state => state.setError);
  const storeError = useChatStore(state => state.error);

  const [retryCount, setRetryCount] = useState(0);
  const [presenceByChatId, setPresenceByChatId] = useState({});

  // Load user's chats when component mounts
  useEffect(() => {
    const loadChats = async () => {
      if (!user) {
        return;
      }

      try {
        setLoadingChats(true);
        setError(null);
        
        const response = await chatService.getUserChats();
        
        let chatsArray = [];
        if (response) {
          if (Array.isArray(response)) {
            chatsArray = response;
          } else if (response.content && Array.isArray(response.content)) {
            chatsArray = response.content;
          } else if (response.data && Array.isArray(response.data)) {
            chatsArray = response.data;
          }
        }
        
        setChats(chatsArray);
      } catch (error) {
        console.error('Failed to load chats:', error);
        setError(error.response?.data?.message || error.message || 'Failed to load chats');
        setChats([]);
      } finally {
        setLoadingChats(false);
      }
    };

    loadChats();
  }, [user, setChats, setError, setLoadingChats, retryCount]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadPresence = async () => {
      const snapshot = Array.isArray(chats) ? chats : [];
      const privateChats = snapshot.filter(
        (chat) => String(chat?.type || '').toUpperCase() !== 'GROUP' && chat?.id && chat?.otherUser?.id
      );
      if (privateChats.length === 0) {
        if (!cancelled) setPresenceByChatId({});
        return;
      }

      const entries = await Promise.all(
        privateChats.map(async (chat) => {
          try {
            const status = await chatService.getPresenceStatus(chat.otherUser.id, chat.id);
            return [chat.id, status || null];
          } catch (error) {
            console.debug('Presence load failed for chat', chat.id, error);
            return [chat.id, null];
          }
        })
      );

      if (!cancelled) {
        setPresenceByChatId(Object.fromEntries(entries));
      }
    };

    loadPresence();
    const timerId = setInterval(loadPresence, 7000);

    return () => {
      cancelled = true;
      clearInterval(timerId);
    };
  }, [user, chats]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  // Show login prompt if no user
  if (!user) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="text.secondary" gutterBottom>
          Please log in to see your chats
        </Typography>
        <Button 
          variant="contained" 
          color="primary"
          href="/login"
        >
          Go to Login
        </Button>
      </Box>
    );
  }
  
  if (storeError) {
    return (
      <Box p={3}>
        <Alert 
          severity="error" 
          action={
            <Button 
              color="inherit" 
              size="small"
              onClick={handleRetry}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          }
        >
          {storeError}
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={3} minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  // Ensure chats is an array
  const chatList = Array.isArray(chats) ? chats : [];

  const handleSelectChat = (chat) => {
    setCurrentChat(chat);
    onSelectChat?.(chat);
  };

  // Show empty state
  if (chatList.length === 0) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="body1" color="text.secondary" paragraph>
          You don't have any chats yet
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Start a new conversation by finding a user to chat with
        </Typography>
        <Button
          variant="contained" 
          color="primary"
          onClick={onFindUsers}
          sx={{ mt: 2 }}
        >
          Find Users
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", bgcolor: "background.paper" }}>
      <Box p={1} borderBottom={1} borderColor="divider">
        <Button variant="outlined" fullWidth onClick={onFindUsers}>
          Find Users
        </Button>
      </Box>
      <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
      {chatList.map((chat) => {
        const isGroup = String(chat.type || '').toUpperCase() === 'GROUP';
        const otherUser = !isGroup ? chat.otherUser : null;
        const otherUserName = isGroup
          ? (chat.groupName || 'Group chat')
          : (
              (otherUser?.firstName || otherUser?.lastName)
                ? `${otherUser?.firstName || ''} ${otherUser?.lastName || ''}`.trim()
                : (otherUser?.username || 'Unknown User')
            );
        const otherUserId = !isGroup ? otherUser?.id : null;
        const presence = presenceByChatId[chat.id];
        const presenceState = derivePresenceState(presence);
        
        // Get last message safely
        const lastMessage = chat.lastMessage || chat.lastMessageContent;
        const lastMessagePreview = lastMessage 
          ? (lastMessage.length > 30 ? lastMessage.substring(0, 30) + '...' : lastMessage)
          : 'No messages yet';
        
        // Get unread count safely
        const unreadCount = chat.unreadCount || 0;
        
        // Get avatar letter safely
        const avatarLetter = otherUserName?.[0]?.toUpperCase() || '?';

        return (
          <ListItem
            key={chat.id}
            onClick={() => handleSelectChat(chat)}
            sx={{
              '&:hover': {
                bgcolor: 'action.hover',
              },
              cursor: 'pointer',
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            <ListItemAvatar>
              <Badge
                variant="dot"
                invisible={!otherUserId}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                overlap="circular"
                sx={{
                  '& .MuiBadge-badge': {
                    bgcolor:
                      presenceState === 'online'
                        ? 'success.main'
                        : presenceState === 'afk'
                          ? 'warning.main'
                          : 'grey.500',
                  },
                }}
              >
                <Avatar>
                  {avatarLetter}
                </Avatar>
              </Badge>
            </ListItemAvatar>
            
            <ListItemText
              primary={
                <Typography variant="subtitle2" noWrap>
                  {otherUserName}
                </Typography>
              }
              secondary={
                <Typography
                  component="span"
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '200px'
                  }}
                >
                  {lastMessagePreview}
                </Typography>
              }
            />
            
            {unreadCount > 0 && (
              <Badge 
                badgeContent={unreadCount} 
                color="primary"
                sx={{ ml: 1 }}
              />
            )}
          </ListItem>
        );
      })}
      </List>
    </Box>
  );
};

export default ChatList;