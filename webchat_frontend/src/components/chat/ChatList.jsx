import React, { useEffect, useRef, useState } from 'react';
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
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Stack,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import useChatStore from '../../store/useChatStore';
import chatService from '../../services/chatService';
import { getApiErrorMessage } from '../../services/api';
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import { derivePresenceState } from '../../utils/presence';
import CreateRoomDialog from './CreateRoomDialog';

/** Accept full app URL (/join/TOKEN), other URLs with ?token=, or raw token. */
function parseInviteToken(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const slashJoin = s.match(/\/join\/([^/?#\s]+)/i);
  if (slashJoin?.[1]) {
    try {
      return decodeURIComponent(slashJoin[1]);
    } catch {
      return slashJoin[1];
    }
  }
  try {
    const u = new URL(s);
    const pathMatch = u.pathname.match(/\/join\/([^/]+)/i);
    if (pathMatch?.[1]) {
      try {
        return decodeURIComponent(pathMatch[1]);
      } catch {
        return pathMatch[1];
      }
    }
    const q = u.searchParams.get('token') || u.searchParams.get('invite');
    if (q?.trim()) return q.trim();
  } catch {
    // not an absolute URL
  }
  return s;
}

function joinInviteErrorMessage(err) {
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err.message === 'string' && err.message.trim()) return err.message;
  return getApiErrorMessage(err, 'Could not join with this invite.');
}

const ChatList = ({ onFindUsers, onSelectChat, onOpenRoomProfile }) => {
  const { user } = useAuthStore();

  const chats = useChatStore(useShallow((state) => state.chats));
  const isLoading = useChatStore((state) => state.isLoadingChats);

  const setChats = useChatStore((state) => state.setChats);
  const setCurrentChat = useChatStore((state) => state.setCurrentChat);
  const upsertChat = useChatStore((state) => state.upsertChat);
  const resetUnreadCount = useChatStore((state) => state.resetUnreadCount);
  const setLoadingChats = useChatStore((state) => state.setLoadingChats);
  const setError = useChatStore((state) => state.setError);
  const storeError = useChatStore((state) => state.error);

  const [retryCount, setRetryCount] = useState(0);
  const [presenceByChatId, setPresenceByChatId] = useState({});
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [createRoomMode, setCreateRoomMode] = useState(null);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const previousUserIdRef = useRef(null);

  useEffect(() => {
    const loadChats = async () => {
      if (!user) {
        previousUserIdRef.current = null;
        return;
      }

      const userId = user.id;
      if (
        previousUserIdRef.current != null &&
        previousUserIdRef.current !== userId
      ) {
        useChatStore.getState().clearStore();
      }
      previousUserIdRef.current = userId;

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

        const allowed = new Set(
          chatsArray.map((c) => (c?.id != null ? String(c.id) : '')).filter(Boolean),
        );
        const current = useChatStore.getState().currentChat;
        if (current?.id != null && !allowed.has(String(current.id))) {
          useChatStore.getState().setCurrentChat(null);
        }
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

  const mergePresenceIntoState = React.useCallback(async (targets) => {
    if (!targets?.length) return;
    const entries = await Promise.all(
      targets.map(async (chat) => {
        try {
          const status = await chatService.getPresenceStatus(chat.otherUser.id, chat.id);
          return [chat.id, status || null];
        } catch {
          return [chat.id, null];
        }
      }),
    );
    setPresenceByChatId((prev) => ({
      ...prev,
      ...Object.fromEntries(entries),
    }));
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadPresence = async () => {
      const snapshot = Array.isArray(chats) ? chats : [];
      const privateChats = snapshot.filter(
        (chat) =>
          String(chat?.type || '').toUpperCase() === 'PRIVATE' &&
          chat?.id &&
          chat?.otherUser?.id,
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
          } catch {
            return [chat.id, null];
          }
        }),
      );

      if (!cancelled) {
        setPresenceByChatId(Object.fromEntries(entries));
      }
    };

    loadPresence();

    const timerId = setInterval(loadPresence, 30000);

    return () => {
      cancelled = true;
      clearInterval(timerId);
    };
  }, [user, chats]);

  useEffect(() => {
    const onBump = async (evt) => {
      const chatId = evt.detail?.chatId;
      const snapshot = Array.isArray(useChatStore.getState().chats)
        ? useChatStore.getState().chats
        : [];
      const chat = snapshot.find((c) => String(c.id) === String(chatId));
      if (!chat?.otherUser?.id || String(chat?.type || '').toUpperCase() !== 'PRIVATE') return;
      await mergePresenceIntoState([chat]);
    };
    window.addEventListener('webchat:presence-refresh', onBump);
    return () => window.removeEventListener('webchat:presence-refresh', onBump);
  }, [mergePresenceIntoState]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  const handleRoomCreated = (dto) => {
    if (!dto?.id) return;
    upsertChat(dto);
    setCurrentChat(dto);
    onSelectChat?.(dto);
  };

  const handleJoinInvite = async () => {
    const token = parseInviteToken(inviteInput);
    if (!token) {
      setInviteError('Paste an invite link or token.');
      return;
    }
    setInviteBusy(true);
    setInviteError('');
    try {
      const dto = await chatService.joinByInvite(token);
      if (!dto?.id) {
        setInviteError('Join succeeded but room data was missing.');
        return;
      }
      upsertChat(dto);
      setCurrentChat(dto);
      onSelectChat?.(dto);
      setInviteInput('');
    } catch (err) {
      setInviteError(joinInviteErrorMessage(err));
    } finally {
      setInviteBusy(false);
    }
  };

  const openMenu = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
  };

  const sidebarFooter = (
    <>
      <Box
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: 'divider',
          py: 0.25,
          px: 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          bgcolor: 'background.paper',
        }}
      >
        <IconButton
          size="small"
          aria-label="Chat options"
          aria-controls={menuAnchor ? 'chat-sidebar-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={menuAnchor ? 'true' : undefined}
          onClick={openMenu}
          sx={{ width: 44, height: 44 }}
        >
          <MoreVertIcon />
        </IconButton>
      </Box>
      <Menu
        id="chat-sidebar-menu"
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        <MenuItem
          onClick={() => {
            closeMenu();
            setCreateRoomMode('group');
          }}
        >
          Create a group chat
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            setCreateRoomMode('channel');
          }}
        >
          Create a channel
        </MenuItem>
      </Menu>
      <CreateRoomDialog
        open={createRoomMode != null}
        mode={createRoomMode === 'channel' ? 'channel' : 'group'}
        onClose={() => setCreateRoomMode(null)}
        onCreated={handleRoomCreated}
      />
    </>
  );

  if (!user) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="text.secondary" gutterBottom>
          Please log in to see your chats
        </Typography>
        <Button variant="contained" color="primary" href="/login">
          Go to Login
        </Button>
      </Box>
    );
  }

  if (storeError) {
    return (
      <Box
        sx={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 3 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleRetry} startIcon={<RefreshIcon />}>
                Retry
              </Button>
            }
          >
            {storeError}
          </Alert>
        </Box>
        {sidebarFooter}
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
        {sidebarFooter}
      </Box>
    );
  }

  const chatList = Array.isArray(chats) ? chats : [];

  const handleSelectChat = (chat) => {
    if (chat?.id) {
      resetUnreadCount(chat.id);
    }
    setCurrentChat(chat);
    onSelectChat?.(chat);
  };

  const listSection =
    chatList.length === 0 ? (
      <Box p={3} textAlign="center">
        <Typography variant="body1" color="text.secondary" paragraph>
          You don&apos;t have any chats yet
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Start a conversation, create a group or channel, or find users and public rooms.
        </Typography>
        <Button variant="contained" color="primary" onClick={onFindUsers} sx={{ mt: 2 }}>
          Find users & rooms
        </Button>
      </Box>
    ) : (
      <List sx={{ width: '100%', bgcolor: 'background.paper', py: 0 }}>
        {chatList.map((chat) => {
          const chatType = String(chat.type || '').toUpperCase();
          const isGroup = chatType === 'GROUP';
          const isChannel = chatType === 'CHANNEL';
          const isGroupOrChannel = isGroup || isChannel;
          const otherUser = !isGroupOrChannel ? chat.otherUser : null;
          const otherUserName = isChannel
            ? chat.groupName || 'Channel'
            : isGroup
              ? chat.groupName || 'Group chat'
              : (otherUser?.firstName || otherUser?.lastName)
                  ? `${otherUser?.firstName || ''} ${otherUser?.lastName || ''}`.trim()
                  : otherUser?.username || 'Unknown User';
          const otherUserId = !isGroupOrChannel ? otherUser?.id : null;
          const presence = presenceByChatId[chat.id];
          const presenceState = derivePresenceState(presence);

          const lastMessage = chat.lastMessage || chat.lastMessageContent;
          const lastMessagePreview = lastMessage
            ? lastMessage.length > 30
              ? `${lastMessage.substring(0, 30)}...`
              : lastMessage
            : 'No messages yet';

          const unreadCount = chat.unreadCount || 0;

          const avatarLetter = otherUserName?.[0]?.toUpperCase() || '?';
          const roomAvatarSrc = isGroupOrChannel
            ? chat.groupPhoto || undefined
            : otherUser?.profilePicture || undefined;

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
                borderColor: 'divider',
              }}
            >
              <ListItemAvatar
                onClick={(e) => {
                  if (isGroupOrChannel) {
                    e.stopPropagation();
                    onOpenRoomProfile?.(chat);
                  }
                }}
                onKeyDown={(e) => {
                  if (!isGroupOrChannel) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenRoomProfile?.(chat);
                  }
                }}
                role={isGroupOrChannel ? 'button' : undefined}
                tabIndex={isGroupOrChannel ? 0 : undefined}
                aria-label={isGroupOrChannel ? 'View room details' : undefined}
                sx={{
                  cursor: isGroupOrChannel ? 'pointer' : 'default',
                  minWidth: 56,
                }}
              >
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
                  <Avatar src={roomAvatarSrc}>{!roomAvatarSrc ? avatarLetter : null}</Avatar>
                </Badge>
              </ListItemAvatar>

              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    {isChannel ? (
                      <Chip
                        size="small"
                        label="Channel"
                        color="primary"
                        variant="outlined"
                        sx={{ flexShrink: 0 }}
                      />
                    ) : null}
                    {isGroup ? (
                      <Chip size="small" label="Group" variant="outlined" sx={{ flexShrink: 0 }} />
                    ) : null}
                    <Typography variant="subtitle2" noWrap sx={{ minWidth: 0 }}>
                      {otherUserName}
                    </Typography>
                  </Box>
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
                      maxWidth: '200px',
                    }}
                  >
                    {lastMessagePreview}
                  </Typography>
                }
              />

              {unreadCount > 0 ? (
                <Badge badgeContent={unreadCount} color="primary" sx={{ ml: 1 }} />
              ) : null}
            </ListItem>
          );
        })}
      </List>
    );

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ flexShrink: 0, p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack spacing={1}>
          <Button variant="outlined" fullWidth onClick={onFindUsers}>
            Find users & rooms
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
            Join with invite link
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="Paste link or token"
            value={inviteInput}
            disabled={inviteBusy}
            onChange={(e) => {
              setInviteInput(e.target.value);
              if (inviteError) setInviteError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleJoinInvite();
              }
            }}
            inputProps={{ 'aria-label': 'Invite link or token' }}
          />
          {inviteError ? (
            <Alert severity="error" onClose={() => setInviteError('')} sx={{ py: 0 }}>
              {inviteError}
            </Alert>
          ) : null}
          <Button
            variant="contained"
            fullWidth
            disabled={inviteBusy || !String(inviteInput).trim()}
            onClick={() => void handleJoinInvite()}
          >
            {inviteBusy ? 'Joining…' : 'Join'}
          </Button>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{listSection}</Box>

      {sidebarFooter}
    </Box>
  );
};

export default ChatList;
