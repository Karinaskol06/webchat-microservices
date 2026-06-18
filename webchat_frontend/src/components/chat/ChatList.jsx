import React, { useEffect, useRef, useState } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import LinkIcon from '@mui/icons-material/Link';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GroupsIcon from '@mui/icons-material/Groups';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import {
  chatColors,
  chatGlassFieldPanelSx,
  chatRadii,
  chatUnreadCountBadgeSx,
  muiTransparent,
} from '../../theme/chatDesignTokens';
import UserAvatar from '../user/UserAvatar';
import { resolveRoomAvatarSrc } from '../../utils/userAvatar';
import { getMessagePreviewText } from '../../utils/personalSpace';
import { isDeletedAccountUser } from '../../utils/chatDisplay';
import RoomMemberInvitesPanel from './RoomMemberInvitesPanel';
import useTranslation from '../../hooks/useTranslation';
import { getApiErrorMessage } from '../../services/api';

const matchesChatFilter = (chat, filter) => {
  const t = String(chat?.type || 'PRIVATE').toUpperCase();
  if (t === 'PERSONAL_SPACE') return false;
  const f = String(filter || 'ALL').toUpperCase();
  if (f === 'ALL') return true;
  if (f === 'ALL') return true;
  if (f === 'ALL') return true;
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
  roomMemberInvites = [],
  roomInviteActionLoading = false,
  onAcceptRoomMemberInvite,
  onDeclineRoomMemberInvite,
}) => {
  const { t } = useTranslation();
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
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null);
  const [draggingChatId, setDraggingChatId] = useState(null);
  const [folderMenuAnchor, setFolderMenuAnchor] = useState(null);
  const previousUserIdRef = useRef(null);

  const listMenuButtonSx = {
    flexShrink: 0,
    width: 40,
    height: 40,
    color: chatColors.glassPanelTextMuted,
  };

  const folders = useChatFolderStore((s) => s.folders);
  const createFolder = useChatFolderStore((s) => s.createFolder);
  const deleteFolder = useChatFolderStore((s) => s.deleteFolder);
  const setActiveFolderId = useChatFolderStore((s) => s.setActiveFolderId);
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

        const localChats = useChatStore.getState().chats;
        const mergedChats = useChatStore.getState().mergeChatsFromServer(chatsArray, localChats);
        setChats(mergedChats);

        const allowed = new Set(
          mergedChats.map((c) => (c?.id != null ? String(c.id) : '')).filter(Boolean),
        );
        const current = useChatStore.getState().currentChat;
        if (current?.id != null && !allowed.has(String(current.id))) {
          const isPersonalSpace = String(current.type || '').toUpperCase() === 'PERSONAL_SPACE';
          if (!isPersonalSpace) {
            useChatStore.getState().setCurrentChat(null);
          }
          if (!isPersonalSpace) {
            useChatStore.getState().setCurrentChat(null);
          }
        }
      } catch (error) {
        console.error('Failed to load chats:', error);
        setError(getApiErrorMessage(error, t('chatList.error.loadFailed')));
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
    if (onSelectChat) {
      onSelectChat(dto);
    } else {
      setCurrentChat(dto);
    }
  };

  const openListMenu = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const closeListMenu = () => {
    setMenuAnchor(null);
  };

  const openFolderMenu = (event) => {
    event.stopPropagation();
    setFolderMenuAnchor(event.currentTarget);
  };

  const closeFolderMenu = () => {
    setFolderMenuAnchor(null);
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
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('chatList.menu.joinViaLink')} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeListMenu();
            setCreateRoomMode('group');
          }}
        >
          <ListItemIcon>
            <GroupsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('chatList.menu.createGroup')} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeListMenu();
            setCreateRoomMode('channel');
          }}
        >
          <ListItemIcon>
            <CampaignOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('chatList.menu.createChannel')} />
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeListMenu();
            setCreateFolderOpen(true);
          }}
        >
          <ListItemIcon>
            <CreateNewFolderOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('chatList.menu.createFolder')} />
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

  if (storeError) {
    return (
      <Box
        sx={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: muiTransparent,
          color: chatColors.glassPanelText,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', overflowX: 'hidden', p: 3 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleRetry} startIcon={<RefreshIcon />}>
                {t('common.retry')}
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
          bgcolor: muiTransparent,
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
      const preview = getMessagePreviewText({
        content: chat.lastMessage || chat.lastMessageContent || '',
      });
      return `${name} ${preview}`.toLowerCase().includes(searchLower);
    });

  const handleSelectChat = (chat) => {
    if (onSelectChat) {
      onSelectChat(chat);
      return;
    }
    setCurrentChat(chat);
    if (chat?.id) {
      resetUnreadCount(chat.id);
    }
  };

  const emptyTitle = activeFolder
    ? t('chatList.empty.noChatsInFolder', { folderName: activeFolder.name })
    : t('chatList.empty.noChats');
  const emptyHint = activeFolder
    ? t('chatList.empty.hintFolder')
    : t('chatList.empty.hintDefault');

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
          {t('chatList.empty.findUsers')}
        </Button>
      </Box>
    ) : (
      <List sx={{ width: '100%', bgcolor: muiTransparent, py: 0 }}>
        {chatList.map((chat) => {
          const chatType = String(chat.type || '').toUpperCase();
          const isGroup = chatType === 'GROUP';
          const isChannel = chatType === 'CHANNEL';
          const isGroupOrChannel = isGroup || isChannel;
          const otherUser = !isGroupOrChannel ? chat.otherUser : null;
          const otherUserName = isChannel
            ? chat.groupName || t('roomType.channel')
            : isGroup
              ? chat.groupName || t('roomType.group')
              : isDeletedAccountUser(otherUser)
                ? t('common.deletedAccount')
                : (otherUser?.firstName || otherUser?.lastName)
                    ? `${otherUser?.firstName || ''} ${otherUser?.lastName || ''}`.trim()
                    : otherUser?.username || t('common.unknownUser');
          const otherUserId = !isGroupOrChannel ? otherUser?.id : null;
          const presence = presenceByChatId[chat.id];
          const presenceState = derivePresenceState(presence);

          const lastMessageRaw = chat.lastMessage || chat.lastMessageContent;
          const lastMessage = lastMessageRaw
            ? getMessagePreviewText({ content: lastMessageRaw })
            : '';
          const lastMessagePreview = lastMessage
            ? lastMessage.length > 30
              ? `${lastMessage.substring(0, 30)}...`
              : lastMessage
            : t('chatList.preview.noMessages');

          const unreadCount = chat.unreadCount || 0;
          const isSelected = String(activeChatId) === String(chat.id);

          const avatarLetter = isGroupOrChannel
            ? (chat.groupName?.[0] || '?').toUpperCase()
            : undefined;
          const roomAvatarSrc = isGroupOrChannel ? resolveRoomAvatarSrc(chat) : undefined;

          const isDragging = draggingChatId === String(chat.id);

          return (
            <ListItem
              key={chat.id}
              draggable
              disablePadding={Boolean(activeFolderId)}
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
                mx: activeFolderId ? 0 : 1,
                mb: 0.5,
                px: activeFolderId ? 1.5 : undefined,
                py: activeFolderId ? 0.75 : undefined,
                pr: activeFolderId ? undefined : 0.5,
                borderRadius: `${chatRadii.avatar}px`,
                bgcolor: isSelected ? chatColors.surfaceMuted : muiTransparent,
                opacity: isDragging ? 0.45 : 1,
                transform: isDragging ? 'scale(0.98)' : 'none',
                transition: 'opacity 0.15s ease, transform 0.15s ease, background-color 0.15s ease',
                '&:hover': {
                  bgcolor: isSelected ? chatColors.surfaceMuted : 'rgba(123, 97, 255, 0.06)',
                },
                cursor: 'grab',
                '&:active': { cursor: 'grabbing' },
                display: 'flex',
                alignItems: 'center',
                gap: 0,
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
                aria-label={isGroupOrChannel ? t('chatList.aria.viewRoomDetails') : undefined}
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
                  {isGroupOrChannel ? (
                    <UserAvatar
                      src={roomAvatarSrc}
                      letter={avatarLetter}
                      disableMediaCache
                    />
                  ) : (
                    <UserAvatar user={otherUser} disableMediaCache />
                  )}
                </Badge>
              </ListItemAvatar>

              <ListItemText
                sx={{ flex: 1, minWidth: 0, my: 0, mr: unreadCount > 0 ? 0.75 : activeFolderId ? 0 : 0 }}
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    {isChannel ? (
                      <Tooltip title={t('roomType.channel')}>
                        <CampaignOutlinedIcon
                          sx={{ fontSize: 18, color: chatColors.primary, flexShrink: 0 }}
                          aria-label={t('roomType.channel')}
                        />
                      </Tooltip>
                    ) : null}
                    {isGroup ? (
                      <Tooltip title={t('roomType.group')}>
                        <GroupsIcon
                          sx={{ fontSize: 18, color: chatColors.glassPanelTextMuted, flexShrink: 0 }}
                          aria-label={t('roomType.group')}
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
                  aria-label={t('chatList.aria.unread', { count: unreadCount })}
                  sx={{
                    ...chatUnreadCountBadgeSx,
                    mr: activeFolderId ? 0.75 : 1.5,
                  }}
                >
                  {unreadCount > 99 ? t('common.badgeOverflow') : unreadCount}
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
        bgcolor: muiTransparent,
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
            <IconButton
              size="small"
              aria-label={t('chatList.aria.folderOptions', { folderName: activeFolder.name })}
              onClick={openFolderMenu}
              sx={{
                ...listMenuButtonSx,
                '&:hover': { color: chatColors.glassPanelText, bgcolor: 'rgba(16, 8, 26, 0.06)' },
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : null}
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('chatList.search.placeholder')}
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
            inputProps={{ 'aria-label': t('chatList.search.ariaLabel') }}
          />
          <Tooltip title={t('chatList.empty.findUsers')}>
            <IconButton
              aria-label={t('chatList.aria.findUsers')}
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
              <Badge
                badgeContent={
                  roomMemberInvites.length > 0
                    ? roomMemberInvites.length > 9
                      ? t('common.badgeOverflow')
                      : roomMemberInvites.length
                    : 0
                }
                overlap="circular"
                invisible={!roomMemberInvites.length}
                sx={{
                  '& .MuiBadge-badge': {
                    bgcolor: chatColors.unreadBadge,
                    color: chatColors.textOnPrimary,
                    fontWeight: 700,
                  },
                }}
              >
                <SearchIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
          {!activeFolder ? (
            <Tooltip title={t('chatList.tooltip.listOptions')}>
              <IconButton
                aria-label={t('chatList.aria.listOptions')}
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
          ) : null}
        </Box>
      </Box>

      <RoomMemberInvitesPanel
        invites={roomMemberInvites}
        loading={roomInviteActionLoading}
        onAccept={onAcceptRoomMemberInvite}
        onDecline={onDeclineRoomMemberInvite}
      />

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
        {listSection}
      </Box>

      {listOptionsMenu}

      <Menu
        id="chat-folder-options-menu"
        anchorEl={folderMenuAnchor}
        open={Boolean(folderMenuAnchor)}
        onClose={closeFolderMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200 } } }}
      >
        <MenuItem
          onClick={() => {
            closeFolderMenu();
            if (activeFolder) setDeleteFolderTarget(activeFolder);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
              <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('chatList.menu.deleteFolder')} />
        </MenuItem>
      </Menu>

      <Dialog
        open={Boolean(deleteFolderTarget)}
        onClose={() => setDeleteFolderTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('chatList.deleteFolder.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('chatList.deleteFolder.body', { folderName: deleteFolderTarget?.name })}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteFolderTarget(null)}>{t('common.cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleteFolderTarget) {
                deleteFolder(deleteFolderTarget.id);
                if (String(activeFolderId) === String(deleteFolderTarget.id)) {
                  setActiveFolderId(null);
                }
              }
              setDeleteFolderTarget(null);
            }}
          >
            {t('chatList.deleteFolder.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatList;
