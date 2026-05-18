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
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import { derivePresenceState } from '../../utils/presence';
import CreateRoomDialog from './CreateRoomDialog';
import CreateFolderDialog from './CreateFolderDialog';
import useChatFolderStore from '../../store/useChatFolderStore';
import { CHAT_DRAG_TYPE } from '../../utils/chatDrag';
import SearchIcon from '@mui/icons-material/Search';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import { chatColors, chatGlassFieldPanelSx, chatRadii } from '../../theme/chatDesignTokens';

const matchesChatFilter = (chat, filter) => {
  const f = String(filter || 'ALL').toUpperCase();
  if (f === 'ALL') return true;
  const t = String(chat?.type || 'PRIVATE').toUpperCase();
  if (f === 'PRIVATE') return t !== 'GROUP' && t !== 'CHANNEL';
  return t === f;
};

const ChatList = ({
  onFindUsers,
  onSelectChat,
  onOpenRoomProfile,
  onJoinViaLink,
  chatFilter = 'ALL',
  activeFolderId = null,
}) => {
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
  const activeChatId = useChatStore((state) => state.currentChat?.id);

  const [retryCount, setRetryCount] = useState(0);
  const [listSearch, setListSearch] = useState('');
  const [presenceByChatId, setPresenceByChatId] = useState({});
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [createRoomMode, setCreateRoomMode] = useState(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [draggingChatId, setDraggingChatId] = useState(null);
  const previousUserIdRef = useRef(null);

  const folders = useChatFolderStore((s) => s.folders);
  const createFolder = useChatFolderStore((s) => s.createFolder);
  const getFolderIdForChat = useChatFolderStore((s) => s.getFolderIdForChat);

  const activeFolder = React.useMemo(
    () => folders.find((f) => f.id === activeFolderId) || null,
    [folders, activeFolderId],
  );

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

  const openListMenu = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const closeListMenu = () => {
    setMenuAnchor(null);
  };

  const listOptionsMenu = (
    <>
      <Menu
        id="chat-list-options-menu"
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeListMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        <MenuItem
          onClick={() => {
            closeListMenu();
            onJoinViaLink?.();
          }}
        >
          Join via link
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeListMenu();
            setCreateRoomMode('group');
          }}
        >
          Create a group chat
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeListMenu();
            setCreateRoomMode('channel');
          }}
        >
          Create a channel
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeListMenu();
            setCreateFolderOpen(true);
          }}
        >
          <CreateNewFolderOutlinedIcon fontSize="small" sx={{ mr: 1.5, color: chatColors.glassPanelTextMuted }} />
          Create folder
        </MenuItem>
      </Menu>
      <CreateRoomDialog
        open={createRoomMode != null}
        mode={createRoomMode === 'channel' ? 'channel' : 'group'}
        onClose={() => setCreateRoomMode(null)}
        onCreated={handleRoomCreated}
      />
      <CreateFolderDialog
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onCreate={(name) => createFolder(name)}
      />
    </>
  );

  if (!user) {
    return (
      <Box p={3} textAlign="center">
        <Typography sx={{ color: chatColors.glassPanelTextMuted }} gutterBottom>
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
          bgcolor: 'transparent',
          color: chatColors.glassPanelText,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', overflowX: 'hidden', p: 3 }}>
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
        {listOptionsMenu}
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
          bgcolor: 'transparent',
          color: chatColors.glassPanelText,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
          <CircularProgress color="primary" />
        </Box>
        {listOptionsMenu}
      </Box>
    );
  }

  const searchLower = listSearch.trim().toLowerCase();
  const chatList = (Array.isArray(chats) ? chats : [])
    .filter((c) => {
      if (activeFolderId) {
        return getFolderIdForChat(c.id) === activeFolderId;
      }
      return matchesChatFilter(c, chatFilter);
    })
    .filter((chat) => {
      if (!searchLower) return true;
      const chatType = String(chat.type || '').toUpperCase();
      const isRoom = chatType === 'GROUP' || chatType === 'CHANNEL';
      const name = isRoom
        ? (chat.groupName || '')
        : `${chat.otherUser?.firstName || ''} ${chat.otherUser?.lastName || ''} ${chat.otherUser?.username || ''}`;
      const preview = String(chat.lastMessage || chat.lastMessageContent || '');
      return `${name} ${preview}`.toLowerCase().includes(searchLower);
    });

  const handleSelectChat = (chat) => {
    setCurrentChat(chat);
    if (chat?.id) {
      resetUnreadCount(chat.id);
    }
    onSelectChat?.(chat);
  };

  const emptyTitle = activeFolder
    ? `No chats in “${activeFolder.name}”`
    : "You don't have any chats yet";
  const emptyHint = activeFolder
    ? 'Drag chats from All chats into this folder using the sidebar, or switch views from the left rail.'
    : 'Start a conversation, create a group or channel, or find users and public rooms.';

  const listSection =
    chatList.length === 0 ? (
      <Box p={3} textAlign="center">
        <Typography variant="body1" paragraph sx={{ color: chatColors.glassPanelTextMuted }}>
          {emptyTitle}
        </Typography>
        <Typography variant="body2" gutterBottom sx={{ color: chatColors.glassPanelTextMuted }}>
          {emptyHint}
        </Typography>
        <Button
          variant="text"
          color="primary"
          onClick={onFindUsers}
          sx={{ mt: 1, display: { xs: 'inline-flex', md: 'none' } }}
        >
          Find users & rooms
        </Button>
      </Box>
    ) : (
      <List sx={{ width: '100%', bgcolor: 'transparent', py: 0 }}>
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
          const isSelected = String(activeChatId) === String(chat.id);

          const avatarLetter = otherUserName?.[0]?.toUpperCase() || '?';
          const roomAvatarSrc = isGroupOrChannel
            ? chat.groupPhoto || undefined
            : otherUser?.profilePicture || undefined;

          const isDragging = draggingChatId === String(chat.id);

          return (
            <ListItem
              key={chat.id}
              draggable
              onDragStart={(e) => {
                const id = String(chat.id);
                e.dataTransfer.setData(CHAT_DRAG_TYPE, id);
                e.dataTransfer.setData('text/plain', id);
                e.dataTransfer.effectAllowed = 'move';
                setDraggingChatId(id);
              }}
              onDragEnd={() => setDraggingChatId(null)}
              onClick={() => handleSelectChat(chat)}
              sx={{
                mx: 1,
                mb: 0.5,
                pr: 0.5,
                borderRadius: `${chatRadii.avatar}px`,
                bgcolor: isSelected ? chatColors.surfaceMuted : 'transparent',
                opacity: isDragging ? 0.45 : 1,
                transform: isDragging ? 'scale(0.98)' : 'none',
                transition: 'opacity 0.15s ease, transform 0.15s ease, background-color 0.15s ease',
                '&:hover': {
                  bgcolor: isSelected ? chatColors.surfaceMuted : 'rgba(123, 97, 255, 0.06)',
                },
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' },
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
                      width: 12,
                      height: 12,
                      minWidth: 12,
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: 'background.paper',
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
                      <Tooltip title="Channel">
                        <CampaignOutlinedIcon
                          sx={{ fontSize: 18, color: chatColors.primary, flexShrink: 0 }}
                          aria-label="Channel"
                        />
                      </Tooltip>
                    ) : null}
                    {isGroup ? (
                      <Tooltip title="Group chat">
                        <GroupsIcon
                          sx={{ fontSize: 18, color: chatColors.glassPanelTextMuted, flexShrink: 0 }}
                          aria-label="Group chat"
                        />
                      </Tooltip>
                    ) : null}
                    <Typography variant="subtitle2" noWrap sx={{ minWidth: 0, color: chatColors.glassPanelText }}>
                      {otherUserName}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '200px',
                      color: chatColors.glassPanelTextMuted,
                    }}
                  >
                    {lastMessagePreview}
                  </Typography>
                }
              />

              {unreadCount > 0 ? (
                <Box
                  component="span"
                  aria-label={`${unreadCount} unread`}
                  sx={{
                    flexShrink: 0,
                    ml: 0.75,
                    mr: 1.25,
                    minWidth: 22,
                    height: 22,
                    px: 0.75,
                    borderRadius: 11,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: chatColors.unreadBadge,
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Box>
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
        bgcolor: 'transparent',
        color: chatColors.glassPanelText,
      }}
    >
      <Box sx={{ flexShrink: 0, p: 1.5, borderBottom: `1px solid ${chatColors.glassPanelBorder}` }}>
        {activeFolder ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              mb: 1,
              px: 0.5,
            }}
          >
            <FolderOutlinedIcon sx={{ fontSize: 20, color: chatColors.primary }} aria-hidden />
            <Typography
              variant="subtitle2"
              fontWeight={700}
              noWrap
              sx={{ flex: 1, minWidth: 0, color: chatColors.glassPanelText }}
            >
              {activeFolder.name}
            </Typography>
          </Box>
        ) : null}
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: chatColors.glassPanelTextMuted, fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              ...chatGlassFieldPanelSx,
              '& .MuiOutlinedInput-root': {
                borderRadius: `${chatRadii.pill}px`,
                bgcolor: chatColors.surfaceMuted,
                '& fieldset': { border: 'none' },
              },
            }}
            inputProps={{ 'aria-label': 'Search chats' }}
          />
          <Tooltip title="Find users & rooms">
            <IconButton
              aria-label="Find users and rooms"
              onClick={onFindUsers}
              sx={{
                display: { xs: 'inline-flex', md: 'none' },
                flexShrink: 0,
                bgcolor: chatColors.surfaceMuted,
                borderRadius: `${chatRadii.pill}px`,
                width: 40,
                height: 40,
                color: chatColors.primary,
              }}
            >
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Chat list options">
            <IconButton
              aria-label="Chat list options"
              onClick={openListMenu}
              sx={{
                flexShrink: 0,
                bgcolor: chatColors.surfaceMuted,
                borderRadius: `${chatRadii.pill}px`,
                width: 40,
                height: 40,
                color: chatColors.glassPanelText,
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
        {listSection}
      </Box>

      {listOptionsMenu}
    </Box>
  );
};

export default ChatList;
