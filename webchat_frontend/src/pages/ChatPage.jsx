import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Box,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import ChatShell from '../components/layout/ChatShell';
import { chatColors } from '../theme/chatDesignTokens';
import { chatMessagesPanelBlurSx } from '../theme/chatAnimations';
import useChatStore from '../store/useChatStore';
import useAuthStore from '../store/useAuthStore';
import chatService from '../services/chatService';
import ChatList from '../components/chat/ChatList';
import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';
import EmojiSidebar from '../components/chat/EmojiSidebar';
import UserProfileDialog from '../components/user/UserProfileDialog';
import ForwardChatDialog from '../components/chat/ForwardChatDialog';
import UserSearchDialog from '../components/chat/UserSearchDialog';
import RoomProfileDialog from '../components/chat/RoomProfileDialog';
import ChatSettingsDialog from '../components/chat/ChatSettingsDialog';
import ChatInMessageSearch from '../components/chat/ChatInMessageSearch';
import ChatInfoSidebar from '../components/chat/ChatInfoSidebar';
import MediaLightbox from '../components/chat/MediaLightbox';
import TwoStepDeleteRoomDialog from '../components/chat/TwoStepDeleteRoomDialog';
import RoomBanDialog from '../components/chat/RoomBanDialog';
import { parseRoomBanError } from '../utils/roomBanError';
import useChatFolderStore from '../store/useChatFolderStore';
import { findInChatMessageMatches } from '../utils/chatMessageSearch';
import useWebSocket from '../hooks/useWebSocket';
import { WEBCHAT_ACTIVATE_CHAT } from '../constants/chatEvents';
import useMessages from '../hooks/useMessages';
import { useUnreadMessageSeparator } from '../hooks/useUnreadMessageSeparator';
import useTyping from '../hooks/useTyping'; 
import { useShallow } from 'zustand/react/shallow';
import contactsService from '../services/contactsService';
import userBanService from '../services/userBanService';
import { useSearchParams } from 'react-router-dom';
import {
  canDeleteRoom,
  canLeaveRoom,
  channelPostingRestricted,
  roomTypeLabel,
} from '../utils/channelPermissions';
import { resolveRoomAvatarSrc } from '../utils/userAvatar';
import PersonalSpaceList from '../components/personalSpace/PersonalSpaceList';
import PollCreationDialog from '../components/chat/PollCreationDialog';
import { getApiErrorMessage } from '../services/api';
import {
  createCalloutPayload,
  createStickyPayload,
  createTodoPayload,
  getMessagePreviewText,
  serializePayload,
} from '../utils/personalSpace';

const ChatPage = () => {
  const { currentChat, messages } = useChatStore(
    useShallow(state => ({
      currentChat: state.currentChat,
      messages: state.messages
    }))
  );

  const { user } = useAuthStore();
  const chats = useChatStore((state) => state.chats);
  const setCurrentChat = useChatStore((state) => state.setCurrentChat);
  const resetUnreadCount = useChatStore((state) => state.resetUnreadCount);
  const removeChat = useChatStore((state) => state.removeChat);
  const assignChatToFolder = useChatFolderStore((s) => s.assignChatToFolder);
  const setActiveFolderId = useChatFolderStore((s) => s.setActiveFolderId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState(null);
  const [myProfileOpen, setMyProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDialogVariant, setSettingsDialogVariant] = useState('settings');
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [roomProfileOpen, setRoomProfileOpen] = useState(false);
  const [roomProfileId, setRoomProfileId] = useState(null);
  const [presenceStatus, setPresenceStatus] = useState(null);
  const [emojiSidebarOpen, setEmojiSidebarOpen] = useState(false);
  const [reactionTargetMessageId, setReactionTargetMessageId] = useState(null);
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [groupInfoPanelOpen, setGroupInfoPanelOpen] = useState(true);
  const [membersPanelOpen, setMembersPanelOpen] = useState(true);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [inChatSearchMatchIndex, setInChatSearchMatchIndex] = useState(-1);
  const [contactStatus, setContactStatus] = useState(null);
  const [contactActionLoading, setContactActionLoading] = useState(false);
  const [roomMemberInvites, setRoomMemberInvites] = useState([]);
  const [roomInviteActionLoading, setRoomInviteActionLoading] = useState(false);
  const [roomBanDialog, setRoomBanDialog] = useState(null);
  const [userBanNotice, setUserBanNotice] = useState('');
  const [messageToForward, setMessageToForward] = useState(null);
  const [personalSpaceActive, setPersonalSpaceActive] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState('chats');
  const [personalSpaces, setPersonalSpaces] = useState([]);
  const [personalSpacesLoading, setPersonalSpacesLoading] = useState(false);
  const [personalSpacesError, setPersonalSpacesError] = useState('');
  const [richMessageSending, setRichMessageSending] = useState(false);
  const [pollCreationOpen, setPollCreationOpen] = useState(false);
  const [leaveRoomDialogOpen, setLeaveRoomDialogOpen] = useState(false);
  const [deleteRoomDialogOpen, setDeleteRoomDialogOpen] = useState(false);
  const [roomActionLoading, setRoomActionLoading] = useState(false);
  const [roomActionError, setRoomActionError] = useState('');
  const addMessage = useChatStore((state) => state.addMessage);
  const updateChatLastMessage = useChatStore((state) => state.updateChatLastMessage);
  const afkTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const isAfkRef = useRef(false);
  const composerRef = useRef(null);
  const messageListRef = useRef(null);
  /** Latest chat id chosen in the UI; URL sync can lag behind rapid list clicks. */
  const userSelectedChatIdRef = useRef(null);

  const {
    composerError,
    setComposerError,
    handleSendMessage,
    handleTyping,
    selectedAttachments,
    handleSelectAttachments,
    handleRemoveAttachment,
    messagesEndRef,
    replyToMessage,
    setReplyToMessage,
    messagesLoading,
  } = useMessages(currentChat, composerRef);

  const otherUser = useMemo(() => {
    if (currentChat?.otherUser) return currentChat.otherUser;
    if (messagesLoading) return null;
    return (
      messages.find((m) => m.sender && m.sender.id !== user?.id)?.sender ?? null
    );
  }, [currentChat?.otherUser, messages, messagesLoading, user?.id]);

  const chatTypeUpper = String(currentChat?.type || '').toUpperCase();
  const isPersonalSpace = chatTypeUpper === 'PERSONAL_SPACE';
  const isPrivateChat = chatTypeUpper === 'PRIVATE';
  const isGroupOrChannel = chatTypeUpper === 'GROUP' || chatTypeUpper === 'CHANNEL';

  const headerTitle = useMemo(() => {
    if (isPersonalSpace) return currentChat?.groupName || 'Personal Space';
    if (!isGroupOrChannel) return undefined;
    if (chatTypeUpper === 'CHANNEL') return currentChat?.groupName || 'Channel';
    return currentChat?.groupName || 'Group chat';
  }, [isGroupOrChannel, isPersonalSpace, chatTypeUpper, currentChat?.groupName]);

  const headerSubtitle = useMemo(() => {
    if (isPersonalSpace) return 'Notes, to-dos & reminders';
    if (!isGroupOrChannel) return undefined;
    const vis = String(currentChat?.visibility || '').toUpperCase();
    const kind = chatTypeUpper === 'CHANNEL' ? 'Channel' : 'Group';
    const visLabel = vis === 'PUBLIC' ? 'Public' : 'Private';
    const mc = currentChat?.memberCount;
    const countPart = typeof mc === 'number' ? ` · ${mc} members` : '';
    return `${kind} · ${visLabel}${countPart}`;
  }, [isGroupOrChannel, isPersonalSpace, chatTypeUpper, currentChat?.visibility, currentChat?.memberCount]);

  useEffect(() => {
    setGroupInfoPanelOpen(true);
    setMembersPanelOpen(isGroupOrChannel && !isPersonalSpace);
  }, [currentChat?.id, isGroupOrChannel, isPersonalSpace]);

  const showSharedMediaPanel =
    (isGroupOrChannel || isPrivateChat || isPersonalSpace) && Boolean(currentChat?.id);
  const showMembersSidePanel = isGroupOrChannel && !isPersonalSpace && Boolean(currentChat?.id);
  const roomSidePanelsVisible =
    showSharedMediaPanel && (groupInfoPanelOpen || (showMembersSidePanel && membersPanelOpen));
  const sharedMediaToggleLabel = isPersonalSpace
    ? 'Space info'
    : isPrivateChat
      ? 'Chat info'
      : chatTypeUpper === 'CHANNEL'
        ? 'Channel info'
        : 'Group info';

  const syncChatIdInUrl = useCallback(
    (chatId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (chatId != null && chatId !== '') {
            next.set('chatId', String(chatId));
          } else {
            next.delete('chatId');
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /** Open a chat in the store and keep the URL in sync so deep-link logic does not override selection. */
  const activateChat = useCallback(
    (chat) => {
      if (!chat) {
        userSelectedChatIdRef.current = null;
        setCurrentChat(null);
        syncChatIdInUrl(null);
        return;
      }
      const chatType = String(chat.type || '').toUpperCase();
      if (chatType === 'PERSONAL_SPACE') {
        setWorkspaceMode('personal-spaces');
        setPersonalSpaceActive(true);
      } else {
        setWorkspaceMode('chats');
        setPersonalSpaceActive(false);
      }
      userSelectedChatIdRef.current = String(chat.id);
      setCurrentChat(chat);
      if (chat.id) {
        resetUnreadCount(chat.id);
        syncChatIdInUrl(chat.id);
      }
    },
    [setCurrentChat, resetUnreadCount, syncChatIdInUrl],
  );

  const refreshPersonalSpaces = useCallback(async () => {
    setPersonalSpacesLoading(true);
    setPersonalSpacesError('');
    try {
      const list = await chatService.listPersonalSpaces();
      const spaces = Array.isArray(list) ? list : [];
      spaces.forEach((space) => useChatStore.getState().upsertChat(space));
      setPersonalSpaces(spaces);
      return spaces;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404 || status === 405) {
        try {
          const room = await chatService.getPersonalSpace();
          if (room?.id) {
            useChatStore.getState().upsertChat(room);
            const spaces = [room];
            setPersonalSpaces(spaces);
            return spaces;
          }
        } catch (fallbackErr) {
          setPersonalSpacesError(getApiErrorMessage(fallbackErr, 'Could not load personal spaces.'));
          return [];
        }
      }
      setPersonalSpacesError(getApiErrorMessage(err, 'Could not load personal spaces.'));
      return [];
    } finally {
      setPersonalSpacesLoading(false);
    }
  }, []);

  const selectPersonalSpaceAfterListChange = useCallback(
    async (spaces) => {
      const currentId = useChatStore.getState().currentChat?.id;
      const currentIsPs =
        String(useChatStore.getState().currentChat?.type || '').toUpperCase() === 'PERSONAL_SPACE';
      if (currentIsPs && currentId && spaces.some((s) => String(s.id) === String(currentId))) {
        return;
      }
      if (spaces.length > 0) {
        activateChat(spaces[0]);
        return;
      }
      try {
        const room = await chatService.getPersonalSpace();
        useChatStore.getState().upsertChat(room);
        setPersonalSpaces([room]);
        activateChat(room);
      } catch (err) {
        console.error('Failed to ensure personal space', err);
        activateChat(null);
      }
    },
    [activateChat],
  );

  const handlePersonalSpacesRefresh = useCallback(async () => {
    const spaces = await refreshPersonalSpaces();
    await selectPersonalSpaceAfterListChange(spaces);
  }, [refreshPersonalSpaces, selectPersonalSpaceAfterListChange]);

  const openPersonalSpaceWorkspace = useCallback(() => {
    setUserSearchOpen(false);
    setSettingsOpen(false);
    setWorkspaceMode('personal-spaces');
    setPersonalSpaceActive(true);
  }, []);

  const loadPersonalSpaceWorkspace = useCallback(async () => {
    const spaces = await refreshPersonalSpaces();
    if (spaces.length === 0) {
      try {
        const room = await chatService.getPersonalSpace();
        useChatStore.getState().upsertChat(room);
        setPersonalSpaces([room]);
        activateChat(room);
      } catch (err) {
        console.error('Failed to open personal space', err);
      }
      return;
    }

    const currentId = useChatStore.getState().currentChat?.id;
    const currentIsPs =
      String(useChatStore.getState().currentChat?.type || '').toUpperCase() === 'PERSONAL_SPACE';
    const match = currentIsPs
      ? spaces.find((space) => String(space.id) === String(currentId))
      : null;
    activateChat(match || spaces[0]);
  }, [refreshPersonalSpaces, activateChat]);

  const enterPersonalSpaceWorkspace = useCallback(() => {
    openPersonalSpaceWorkspace();
    void loadPersonalSpaceWorkspace();
  }, [openPersonalSpaceWorkspace, loadPersonalSpaceWorkspace]);

  const exitPersonalSpaceWorkspace = useCallback(() => {
    setWorkspaceMode('chats');
    setPersonalSpaceActive(false);
  }, []);

  const handleInsertRichMessage = useCallback(
    async (type) => {
      if (!currentChat?.id || richMessageSending) return;
      const upper = String(type || '').toUpperCase();
      if (upper === 'POLL') {
        setPollCreationOpen(true);
        return;
      }
      let payload;
      switch (upper) {
        case 'TODO':
          payload = createTodoPayload();
          break;
        case 'STICKY_NOTE':
          payload = createStickyPayload(
            messageListRef.current?.getStickyPlacement?.() ?? { x: 40, y: 40 },
          );
          break;
        case 'CALLOUT':
          payload = createCalloutPayload();
          break;
        default:
          return;
      }
      setRichMessageSending(true);
      setComposerError('');
      try {
        const created = await chatService.sendRichMessage(
          currentChat.id,
          upper,
          serializePayload(payload),
          replyToMessage?.id || null,
        );
        addMessage(created);
        updateChatLastMessage(currentChat.id, {
          content: getMessagePreviewText(created),
          timestamp: created.timestamp ?? new Date().toISOString(),
          senderId: user?.id,
          messageType: created.messageType ?? created.message_type,
        });
        if (upper === 'STICKY_NOTE') {
          requestAnimationFrame(() => messageListRef.current?.revealSticky?.(created));
        }
        setReplyToMessage(null);
      } catch (error) {
        console.error('Failed to insert block', error);
        setComposerError('Could not add this block. Please try again.');
      } finally {
        setRichMessageSending(false);
      }
    },
    [
      addMessage,
      updateChatLastMessage,
      currentChat?.id,
      replyToMessage?.id,
      richMessageSending,
      setComposerError,
      setReplyToMessage,
      user?.id,
    ],
  );

  const handlePostPoll = useCallback(
    async (serializedPayload) => {
      if (!currentChat?.id) return;
      setRichMessageSending(true);
      setComposerError('');
      try {
        const created = await chatService.sendRichMessage(
          currentChat.id,
          'POLL',
          serializedPayload,
          replyToMessage?.id || null,
        );
        addMessage(created);
        updateChatLastMessage(currentChat.id, {
          content: getMessagePreviewText(created),
          timestamp: created.timestamp ?? new Date().toISOString(),
          senderId: user?.id,
          messageType: created.messageType ?? created.message_type,
        });
        setReplyToMessage(null);
      } catch (error) {
        console.error('Failed to create poll', error);
        setComposerError('Could not create poll. Please try again.');
        throw error;
      } finally {
        setRichMessageSending(false);
      }
    },
    [
      addMessage,
      updateChatLastMessage,
      currentChat?.id,
      replyToMessage?.id,
      setComposerError,
      setReplyToMessage,
      user?.id,
    ],
  );

  const headerAvatarSrc =
    isGroupOrChannel || isPersonalSpace ? resolveRoomAvatarSrc(currentChat) : undefined;
  const headerAvatarCacheKey =
    isGroupOrChannel || isPersonalSpace
      ? currentChat?.groupPhotoRevision
      : currentChat?.otherUser?.avatarRevision;
  const { openSeparatorIndex, liveBeforeMessageId, scrollToMessageId } =
    useUnreadMessageSeparator({
      userId: user?.id,
      chatId: currentChat?.id,
      chatUnreadCount: currentChat?.unreadCount,
      messages,
    });

  const headerAvatarLetter = useMemo(() => {
    if (isPersonalSpace) return 'P';
    if (!isGroupOrChannel) return undefined;
    const n = currentChat?.groupName;
    return (n?.[0] || (chatTypeUpper === 'CHANNEL' ? 'C' : 'G')).toUpperCase();
  }, [isGroupOrChannel, isPersonalSpace, chatTypeUpper, currentChat?.groupName]);

  const showCopyRoomInvite = Boolean(
    isGroupOrChannel &&
      String(currentChat?.visibility || '').toUpperCase() === 'PRIVATE' &&
      ((chatTypeUpper === 'GROUP' && currentChat?.isCurrentUserAdmin) ||
        (chatTypeUpper === 'CHANNEL' &&
          (currentChat?.isCurrentUserChannelCreator ||
            currentChat?.isCurrentUserChannelAdmin))),
  );

  const handleCopyRoomInvite = useCallback(async () => {
    if (!currentChat?.id) return;
    try {
      const data = await chatService.getRoomInvite(currentChat.id);
      const token = data?.token;
      if (!token) return;
      const url = `${window.location.origin}/join/${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(url);
    } catch (err) {
      console.error('Copy invite failed:', err);
    }
  }, [currentChat?.id]);

  const clearRoomFromClient = useCallback(
    (chatId) => {
      if (chatId != null) {
        removeChat(chatId);
        assignChatToFolder(chatId, null);
      }
      activateChat(null);
      setLeaveRoomDialogOpen(false);
      setDeleteRoomDialogOpen(false);
      setRoomActionError('');
    },
    [removeChat, assignChatToFolder, activateChat],
  );

  const handleConfirmLeaveRoom = useCallback(async () => {
    if (!currentChat?.id) return;
    setRoomActionLoading(true);
    setRoomActionError('');
    try {
      await chatService.leaveChat(currentChat.id);
      clearRoomFromClient(currentChat.id);
    } catch (err) {
      setRoomActionError(err?.message || 'Failed to leave room');
    } finally {
      setRoomActionLoading(false);
    }
  }, [currentChat?.id, clearRoomFromClient]);

  const handleConfirmDeleteRoom = useCallback(async () => {
    if (!currentChat?.id) return;
    const wasPersonalSpace = String(currentChat?.type || '').toUpperCase() === 'PERSONAL_SPACE';
    const deletedId = currentChat.id;
    setRoomActionLoading(true);
    setRoomActionError('');
    try {
      await chatService.deleteRoom(deletedId);
      removeChat(deletedId);
      assignChatToFolder(deletedId, null);
      setDeleteRoomDialogOpen(false);
      setRoomActionError('');
      if (wasPersonalSpace && workspaceMode === 'personal-spaces') {
        const spaces = await refreshPersonalSpaces();
        await selectPersonalSpaceAfterListChange(spaces);
      } else {
        activateChat(null);
      }
    } catch (err) {
      setRoomActionError(err?.message || 'Failed to delete room');
    } finally {
      setRoomActionLoading(false);
    }
  }, [
    currentChat?.id,
    currentChat?.type,
    removeChat,
    assignChatToFolder,
    activateChat,
    workspaceMode,
    refreshPersonalSpaces,
    selectPersonalSpaceAfterListChange,
  ]);

  const roomDisplayName = currentChat?.groupName || roomTypeLabel(currentChat);

  // Use the typing hook instead of direct store access
  const { isOtherUserTyping } = useTyping(currentChat, otherUser);

  const closeProfileDialog = () => {
    setProfileDialogOpen(false);
    setProfileDialogUser(null);
  };

  const handleProfileBanStateChange = useCallback(
    async ({ userId, banned }) => {
      const targetId = Number(userId);
      if (!Number.isFinite(targetId)) return;

      if (banned) {
        const store = useChatStore.getState();
        const privateChat = store.chats.find(
          (chat) =>
            String(chat?.type || '').toUpperCase() === 'PRIVATE' &&
            Number(chat.otherUser?.id) === targetId,
        );
        if (privateChat?.id) {
          removeChat(privateChat.id);
        }
        const openChat = store.currentChat;
        if (
          String(openChat?.type || '').toUpperCase() === 'PRIVATE' &&
          Number(openChat?.otherUser?.id) === targetId
        ) {
          activateChat(null);
        }
        return;
      }

      try {
        const list = await chatService.getUserChats();
        useChatStore.getState().setChats(Array.isArray(list) ? list : list?.content || []);
      } catch (error) {
        console.debug('Failed to refresh chats after unban', error);
      }
    },
    [removeChat, activateChat],
  );

  const openPartnerProfile = () => {
    if (!otherUser) return;
    setProfileDialogUser(otherUser);
    setProfileDialogOpen(true);
  };

  const openForwardedProfile = (userLike) => {
    if (userLike == null || userLike.id == null) return;
    setProfileDialogUser(userLike);
    setProfileDialogOpen(true);
  };

  const mergeRoomMemberInvite = useCallback((invite) => {
    if (!invite?.id || String(invite.state || '').toUpperCase() !== 'PENDING') return;
    setRoomMemberInvites((prev) => {
      const rest = prev.filter((item) => item.id !== invite.id);
      return [invite, ...rest];
    });
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setRoomMemberInvites([]);
      return;
    }
    chatService
      .listPendingRoomMemberInvites()
      .then((list) => setRoomMemberInvites(Array.isArray(list) ? list : []))
      .catch(() => setRoomMemberInvites([]));
  }, [user?.id]);

  useWebSocket(user, currentChat?.id, user?.id, {
    onRoomMemberInvite: mergeRoomMemberInvite,
  });

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

  // Close emoji sidebar when leaving the conversation (not when opening one)
  useEffect(() => {
    if (!currentChat) {
      setEmojiSidebarOpen(false);
      setReactionTargetMessageId(null);
    }
  }, [currentChat]);

  const handleOpenEmojiSidebarForReaction = useCallback((messageId) => {
    setReactionTargetMessageId(messageId != null ? String(messageId) : null);
    setEmojiSidebarOpen(true);
  }, []);

  const handleEmojiSidebarPick = useCallback(
    async (emoji) => {
      if (reactionTargetMessageId && currentChat?.id) {
        try {
          const reactions = await chatService.toggleMessageReaction(
            currentChat.id,
            reactionTargetMessageId,
            emoji,
          );
          useChatStore.getState().updateMessageReactions(reactionTargetMessageId, reactions);
        } catch {
          // MessageItem shows errors for quick bar; sidebar picks fail silently here
        }
        return;
      }
      composerRef.current?.appendText(emoji);
    },
    [reactionTargetMessageId, currentChat?.id],
  );

  const handleCloseEmojiSidebar = useCallback(() => {
    setEmojiSidebarOpen(false);
    setReactionTargetMessageId(null);
  }, []);

  // Fetch presence status for the interlocutor (private chats only)
  useEffect(() => {
    const isPrivate = String(currentChat?.type || '').toUpperCase() === 'PRIVATE';
    if (!currentChat?.id || !otherUser?.id || !isPrivate) {
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
  }, [currentChat?.id, currentChat?.type, otherUser?.id]);

  useEffect(() => {
    const isPrivate = String(currentChat?.type || '').toUpperCase() === 'PRIVATE';
    const loadContactStatus = async () => {
      if (!currentChat?.id || !otherUser?.id || !isPrivate) {
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
  }, [currentChat?.id, currentChat?.type, otherUser?.id, user?.id]);

  const handleSelectUserForNewChat = async (selectedUser) => {
    if (!selectedUser) return;
    if (user?.id) {
      try {
        const banned = await userBanService.getBanStatus(selectedUser.id, user.id);
        if (banned) {
          setUserBanNotice(
            'You banned this user. Unban them from their profile to restore your private chat.',
          );
          return;
        }
      } catch (error) {
        console.debug('Ban status check failed', error);
      }
    }
    setUserBanNotice('');
    const existingChat = useChatStore
      .getState()
      .chats.find((chat) => Number(chat.otherUser?.id) === Number(selectedUser.id));
    if (existingChat) {
      activateChat(existingChat);
      return;
    }
    activateChat({
      id: null,
      type: 'PRIVATE',
      otherUser: {
        id: selectedUser.id,
        username: selectedUser.username,
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        profilePicture: selectedUser.avatar ?? selectedUser.profilePicture ?? null,
      },
      lastMessage: null,
      unreadCount: 0,
    });
  };

  const urlChatId = searchParams.get('chatId');

  /** Apply chat from URL for deep links/notifications; never revert a newer in-app selection. */
  useEffect(() => {
    const openId = useChatStore.getState().currentChat?.id;
    const userSelectedId = userSelectedChatIdRef.current;

    if (userSelectedId && openId != null && String(openId) === userSelectedId) {
      if (urlChatId && String(urlChatId) !== userSelectedId) {
        syncChatIdInUrl(userSelectedId);
        return;
      }
      if (urlChatId && String(urlChatId) === userSelectedId) {
        userSelectedChatIdRef.current = null;
      }
    }

    if (!urlChatId || !Array.isArray(chats) || chats.length === 0) {
      return;
    }
    const targetChat = chats.find((chat) => String(chat.id) === urlChatId);
    if (!targetChat) {
      return;
    }
    if (openId != null && String(openId) === urlChatId) {
      return;
    }
    setCurrentChat(targetChat);
  }, [urlChatId, chats, setCurrentChat, syncChatIdInUrl]);

  useEffect(() => {
    const markRead = searchParams.get('markRead');
    const chatId = searchParams.get('chatId');
    if (markRead !== '1' || !chatId) {
      return;
    }
    chatService.markAsRead(chatId).catch(() => {});
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('markRead');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const onActivateChatEvent = (event) => {
      const chatId = event?.detail?.chatId;
      const forwardedMessage = event?.detail?.message;
      if (!chatId) return;
      const chat = chats.find((c) => String(c.id) === String(chatId));
      if (!chat) return;
      activateChat(chat);
      if (forwardedMessage) {
        useChatStore.getState().addMessage(forwardedMessage);
      }
    };
    window.addEventListener(WEBCHAT_ACTIVATE_CHAT, onActivateChatEvent);
    return () => window.removeEventListener(WEBCHAT_ACTIVATE_CHAT, onActivateChatEvent);
  }, [chats, activateChat]);

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

  const handleAcceptRoomMemberInvite = async (invite) => {
    if (!invite?.id) return;
    try {
      setRoomInviteActionLoading(true);
      const dto = await chatService.acceptRoomMemberInvite(invite.id);
      setRoomMemberInvites((prev) => prev.filter((item) => item.id !== invite.id));
      if (dto?.id) {
        useChatStore.getState().upsertChat(dto);
        activateChat(dto);
      }
    } catch (e) {
      const ban = parseRoomBanError(e);
      if (ban) {
        setRoomBanDialog(ban);
      }
      setRoomMemberInvites((prev) => prev.filter((item) => item.id !== invite.id));
    } finally {
      setRoomInviteActionLoading(false);
    }
  };

  const handleDeclineRoomMemberInvite = async (invite) => {
    if (!invite?.id) return;
    try {
      setRoomInviteActionLoading(true);
      await chatService.declineRoomMemberInvite(invite.id);
      setRoomMemberInvites((prev) => prev.filter((item) => item.id !== invite.id));
    } finally {
      setRoomInviteActionLoading(false);
    }
  };

  const handleJoinedRoom = useCallback((dto) => {
    if (!dto?.id) return;
    useChatStore.getState().upsertChat(dto);
    activateChat(dto);
    setUserSearchOpen(false);
    setSettingsOpen(false);
  }, [activateChat]);

  const openRoomProfileById = useCallback((id) => {
    if (!id) return;
    setRoomProfileId(String(id));
    setRoomProfileOpen(true);
  }, []);

  const openRoomProfileFromChat = useCallback(
    (chat) => {
      if (chat?.id) openRoomProfileById(chat.id);
    },
    [openRoomProfileById],
  );

  const openRoomProfileFromHeader = useCallback(() => {
    if (currentChat?.id && (isGroupOrChannel || isPersonalSpace)) {
      openRoomProfileById(currentChat.id);
    }
  }, [currentChat?.id, isGroupOrChannel, isPersonalSpace, openRoomProfileById]);

  const closeRoomProfile = useCallback(() => {
    setRoomProfileOpen(false);
    setRoomProfileId(null);
  }, []);

  const channelComposerLocked = channelPostingRestricted(currentChat);

  const inChatSearchMatches = useMemo(
    () => findInChatMessageMatches(messages, inChatSearchQuery),
    [messages, inChatSearchQuery],
  );

  const activeInChatSearchMatch = useMemo(() => {
    if (inChatSearchMatchIndex < 0 || inChatSearchMatchIndex >= inChatSearchMatches.length) {
      return null;
    }
    return inChatSearchMatches[inChatSearchMatchIndex];
  }, [inChatSearchMatches, inChatSearchMatchIndex]);

  useEffect(() => {
    setInChatSearchOpen(false);
    setInChatSearchQuery('');
    setInChatSearchMatchIndex(-1);
  }, [currentChat?.id]);

  useEffect(() => {
    const trimmed = inChatSearchQuery.trim();
    if (!trimmed || inChatSearchMatches.length === 0) {
      if (inChatSearchMatchIndex !== -1) setInChatSearchMatchIndex(-1);
      return;
    }
    if (inChatSearchMatchIndex < 0 || inChatSearchMatchIndex >= inChatSearchMatches.length) {
      setInChatSearchMatchIndex(0);
    }
  }, [inChatSearchQuery, inChatSearchMatches, inChatSearchMatchIndex]);

  const closeInChatSearch = useCallback(() => {
    setInChatSearchOpen(false);
    setInChatSearchQuery('');
    setInChatSearchMatchIndex(-1);
  }, []);

  const toggleInChatSearch = useCallback(() => {
    setInChatSearchOpen((open) => {
      if (open) {
        setInChatSearchQuery('');
        setInChatSearchMatchIndex(-1);
      }
      return !open;
    });
  }, []);

  const goPrevInChatSearchMatch = useCallback(() => {
    if (inChatSearchMatches.length === 0) return;
    setInChatSearchMatchIndex((idx) => {
      const safe = idx < 0 ? 0 : idx;
      return safe <= 0 ? inChatSearchMatches.length - 1 : safe - 1;
    });
  }, [inChatSearchMatches.length]);

  const goNextInChatSearchMatch = useCallback(() => {
    if (inChatSearchMatches.length === 0) return;
    setInChatSearchMatchIndex((idx) => {
      const safe = idx < 0 ? 0 : idx;
      return safe >= inChatSearchMatches.length - 1 ? 0 : safe + 1;
    });
  }, [inChatSearchMatches.length]);

  const mainConversation = currentChat ? (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box
        sx={{
          flexShrink: 0,
          px: { xs: 1.5, sm: 2.5 },
          py: 2,
          borderBottom: `1px solid ${chatColors.borderSubtle}`,
          bgcolor: chatColors.conversationBg,
        }}
      >
        <ChatHeader
          otherUser={otherUser}
          presenceStatus={presenceStatus}
          isTyping={isOtherUserTyping}
          emojiSidebarOpen={emojiSidebarOpen}
          onOpenProfile={isGroupOrChannel || isPersonalSpace ? openRoomProfileFromHeader : openPartnerProfile}
          onShowEmojiSidebar={() => setEmojiSidebarOpen(true)}
          headerTitle={headerTitle}
          headerSubtitle={headerSubtitle}
          headerAvatarSrc={headerAvatarSrc}
          headerAvatarCacheKey={headerAvatarCacheKey}
          headerAvatarLetter={headerAvatarLetter}
          headerAvatarClickable={isGroupOrChannel || isPersonalSpace || Boolean(otherUser)}
          showCopyInvite={showCopyRoomInvite}
          onCopyInvite={handleCopyRoomInvite}
          isGroupOrChannel={isGroupOrChannel}
          canLeaveRoom={canLeaveRoom(currentChat)}
          canDeleteRoom={canDeleteRoom(currentChat)}
          onRequestLeaveRoom={() => {
            setRoomActionError('');
            setLeaveRoomDialogOpen(true);
          }}
          onRequestDeleteRoom={() => {
            setRoomActionError('');
            setDeleteRoomDialogOpen(true);
          }}
          inChatSearchOpen={inChatSearchOpen}
          onToggleInChatSearch={toggleInChatSearch}
          showGroupInfoToggle={showSharedMediaPanel}
          groupInfoPanelOpen={groupInfoPanelOpen}
          onToggleGroupInfoPanel={() => setGroupInfoPanelOpen((open) => !open)}
          showMembersPanelToggle={showMembersSidePanel}
          membersPanelOpen={membersPanelOpen}
          onToggleMembersPanel={() => setMembersPanelOpen((open) => !open)}
          groupInfoToggleLabel={sharedMediaToggleLabel}
        />
      </Box>

      <ChatInMessageSearch
        open={inChatSearchOpen}
        query={inChatSearchQuery}
        onQueryChange={(value) => {
          setInChatSearchQuery(value);
          setInChatSearchMatchIndex(-1);
        }}
        matchCount={inChatSearchMatches.length}
        activeMatchIndex={inChatSearchMatchIndex}
        onPrevMatch={goPrevInChatSearchMatch}
        onNextMatch={goNextInChatSearchMatch}
        onClose={closeInChatSearch}
      />

      {contactStatus?.state === 'PENDING' &&
        !isGroupOrChannel &&
        Number(contactStatus?.prompt?.fromUserId) === Number(otherUser?.id) && (
        <Alert
          severity="info"
          sx={{ mx: 2, mt: 1, borderRadius: 3 }}
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

      {userBanNotice ? (
        <Alert severity="warning" sx={{ mx: 2, mt: 1, borderRadius: 3 }} onClose={() => setUserBanNotice('')}>
          {userBanNotice}
        </Alert>
      ) : null}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...chatMessagesPanelBlurSx(messagesLoading),
        }}
      >
        <MessageList
          ref={messageListRef}
          messages={messages}
          currentUserId={user?.id}
          room={currentChat}
          chatId={currentChat?.id}
          messagesEndRef={messagesEndRef}
          onReply={setReplyToMessage}
          onOpenForward={(msg) => setMessageToForward(msg)}
          onOpenForwardedProfile={openForwardedProfile}
          openSeparatorIndex={openSeparatorIndex}
          liveBeforeMessageId={liveBeforeMessageId}
          scrollToMessageId={scrollToMessageId}
          hideChannelReplyActions={channelComposerLocked}
          inChatSearchQuery={inChatSearchQuery}
          inChatSearchMatches={inChatSearchMatches}
          activeInChatSearchMatch={activeInChatSearchMatch}
          onOpenEmojiSidebarForReaction={handleOpenEmojiSidebarForReaction}
          isPersonalSpace={isPersonalSpace}
        />
      </Box>

      <MessageInput
        ref={composerRef}
        chatId={currentChat?.id}
        onSend={handleSendMessage}
        onTyping={handleTypingWithPresence}
        attachments={selectedAttachments}
        onSelectAttachments={handleSelectAttachments}
        onRemoveAttachment={handleRemoveAttachment}
        replyToMessage={replyToMessage}
        onCancelReply={() => setReplyToMessage(null)}
        emojiSidebarOpen={emojiSidebarOpen}
        onToggleEmojiSidebar={() => setEmojiSidebarOpen((prev) => !prev)}
        composerError={composerError}
        onDismissComposerError={() => setComposerError('')}
        channelReadOnly={channelComposerLocked}
        channelReadOnlyHint="Only the channel owner, moderators, or members granted posting can send messages here."
        onInsertRichMessage={handleInsertRichMessage}
        richMessageSending={richMessageSending}
        showPollOption={isGroupOrChannel && !isPersonalSpace}
      />

      <PollCreationDialog
        open={pollCreationOpen}
        onClose={() => setPollCreationOpen(false)}
        onSubmit={handlePostPoll}
        submitting={richMessageSending}
      />

      <UserProfileDialog
        open={profileDialogOpen && Boolean(profileDialogUser)}
        onClose={closeProfileDialog}
        user={profileDialogUser}
        currentUserId={user?.id}
        onBanStateChange={handleProfileBanStateChange}
      />

      <ForwardChatDialog
        open={Boolean(messageToForward)}
        message={messageToForward}
        onClose={() => setMessageToForward(null)}
        onActivateChat={activateChat}
      />
    </Box>
  ) : (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        textAlign: 'center',
        bgcolor: chatColors.conversationBg,
      }}
    >
      <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: chatColors.textPrimary }}>
        Welcome to WebChat
      </Typography>
      <Typography variant="body1" sx={{ maxWidth: 360, color: chatColors.textSecondary }}>
        Choose a conversation from the list or find users and rooms to get started.
      </Typography>
    </Box>
  );

  return (
    <>
      <MediaLightbox />
      <ChatShell
        hasActiveChat={Boolean(currentChat)}
        onBackFromChat={() => activateChat(null)}
        onOpenProfile={() => setMyProfileOpen(true)}
        onOpenSettings={() => {
          setSettingsDialogVariant('settings');
          setSettingsOpen(true);
        }}
        settingsOpen={settingsOpen}
        onFindUsers={() => setUserSearchOpen(true)}
        findUsersOpen={userSearchOpen}
        pendingRoomInviteCount={roomMemberInvites.length}
        onFolderViewChange={() => {
          exitPersonalSpaceWorkspace();
          activateChat(null);
        }}
        personalSpaceActive={personalSpaceActive}
        onPersonalSpaceSelect={enterPersonalSpaceWorkspace}
        onExitPersonalSpaceMode={exitPersonalSpaceWorkspace}
        listPanel={({ chatFilter, activeFolderId }) =>
          workspaceMode === 'personal-spaces' ? (
            <PersonalSpaceList
              spaces={personalSpaces}
              loading={personalSpacesLoading}
              error={personalSpacesError}
              onRefresh={() => void handlePersonalSpacesRefresh()}
              onSelectSpace={activateChat}
              onOpenSpaceProfile={openRoomProfileFromChat}
              activeSpaceId={currentChat?.id}
            />
          ) : (
            <ChatList
              chatFilter={chatFilter}
              activeFolderId={activeFolderId}
              onFindUsers={() => setUserSearchOpen(true)}
              onJoinViaLink={() => {
                setSettingsDialogVariant('join');
                setSettingsOpen(true);
              }}
              onOpenRoomProfile={openRoomProfileFromChat}
              onSelectChat={activateChat}
              roomMemberInvites={roomMemberInvites}
              roomInviteActionLoading={roomInviteActionLoading}
              onAcceptRoomMemberInvite={handleAcceptRoomMemberInvite}
              onDeclineRoomMemberInvite={handleDeclineRoomMemberInvite}
            />
          )
        }
        mainPanel={
          <Box sx={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {mainConversation}
            </Box>
            {emojiSidebarOpen && currentChat ? (
              <EmojiSidebar
                highlighted={Boolean(reactionTargetMessageId)}
                reactionMode={Boolean(reactionTargetMessageId)}
                onClose={handleCloseEmojiSidebar}
                onEmojiClick={handleEmojiSidebarPick}
              />
            ) : null}
          </Box>
        }
        showInfoPanel={roomSidePanelsVisible}
        infoPanel={
          showSharedMediaPanel ? (
            <ChatInfoSidebar
              room={currentChat}
              currentUserId={user?.id}
              onMemberClick={handleSelectUserForNewChat}
              onOpenRoomProfile={
                isPrivateChat ? openPartnerProfile : openRoomProfileFromHeader
              }
              showMembersPanel={showMembersSidePanel}
              groupInfoOpen={groupInfoPanelOpen}
              membersOpen={membersPanelOpen}
              onCloseGroupInfo={() => setGroupInfoPanelOpen(false)}
              onCloseMembers={() => setMembersPanelOpen(false)}
            />
          ) : null
        }
      />

      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
        onSelectUser={handleSelectUserForNewChat}
        onJoinedRoom={handleJoinedRoom}
        onOpenExistingRoom={handleJoinedRoom}
        currentUserId={user?.id}
      />

      <UserProfileDialog
        open={myProfileOpen}
        onClose={() => setMyProfileOpen(false)}
        user={user}
        editable
      />

      <ChatSettingsDialog
        open={settingsOpen}
        variant={settingsDialogVariant}
        onClose={() => setSettingsOpen(false)}
        onJoinedRoom={handleJoinedRoom}
        onOpenContact={handleSelectUserForNewChat}
        currentUserId={user?.id}
        currentUser={user}
      />

      <RoomProfileDialog open={roomProfileOpen} roomId={roomProfileId} onClose={closeRoomProfile} />

      <Dialog
        open={leaveRoomDialogOpen}
        onClose={() => !roomActionLoading && setLeaveRoomDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Leave {roomTypeLabel(currentChat)}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You will no longer see messages from <strong>{roomDisplayName}</strong>. You can rejoin
            if the room is public or you receive a new invite.
          </DialogContentText>
          {roomActionError ? (
            <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
              {roomActionError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLeaveRoomDialogOpen(false)} disabled={roomActionLoading}>
            Cancel
          </Button>
          <Button
            color="primary"
            variant="contained"
            disabled={roomActionLoading}
            onClick={() => void handleConfirmLeaveRoom()}
          >
            {roomActionLoading ? 'Leaving…' : 'Leave'}
          </Button>
        </DialogActions>
      </Dialog>

      <TwoStepDeleteRoomDialog
        open={deleteRoomDialogOpen}
        roomLabel={roomDisplayName}
        roomTypeLabel={roomTypeLabel(currentChat)}
        loading={roomActionLoading}
        error={roomActionError}
        onClose={() => {
          if (!roomActionLoading) setDeleteRoomDialogOpen(false);
        }}
        onConfirmDelete={() => void handleConfirmDeleteRoom()}
      />

      <RoomBanDialog
        open={Boolean(roomBanDialog)}
        onClose={() => setRoomBanDialog(null)}
        message={roomBanDialog?.message}
        roomName={roomBanDialog?.roomName}
        roomType={roomBanDialog?.roomType}
      />
    </>
  );
};

export default ChatPage;