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
import TwoStepDeleteRoomDialog from '../components/chat/TwoStepDeleteRoomDialog';
import useChatFolderStore from '../store/useChatFolderStore';
import { findInChatMessageMatches } from '../utils/chatMessageSearch';
import useWebSocket from '../hooks/useWebSocket';
import { WEBCHAT_ACTIVATE_CHAT } from '../constants/chatEvents';
import useMessages from '../hooks/useMessages';
import { useUnreadMessageSeparator } from '../hooks/useUnreadMessageSeparator';
import useTyping from '../hooks/useTyping'; 
import { useShallow } from 'zustand/react/shallow';
import contactsService from '../services/contactsService';
import { useSearchParams } from 'react-router-dom';
import {
  canDeleteRoom,
  canLeaveRoom,
  channelPostingRestricted,
  roomTypeLabel,
} from '../utils/channelPermissions';
import { resolveRoomAvatarSrc } from '../utils/userAvatar';
import {
  createCalloutPayload,
  createStickyPayload,
  createTodoPayload,
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
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [inChatSearchMatchIndex, setInChatSearchMatchIndex] = useState(-1);
  const [contactStatus, setContactStatus] = useState(null);
  const [contactActionLoading, setContactActionLoading] = useState(false);
  const [roomMemberInvites, setRoomMemberInvites] = useState([]);
  const [roomInviteActionLoading, setRoomInviteActionLoading] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  const [personalSpaceActive, setPersonalSpaceActive] = useState(false);
  const [richMessageSending, setRichMessageSending] = useState(false);
  const [leaveRoomDialogOpen, setLeaveRoomDialogOpen] = useState(false);
  const [deleteRoomDialogOpen, setDeleteRoomDialogOpen] = useState(false);
  const [roomActionLoading, setRoomActionLoading] = useState(false);
  const [roomActionError, setRoomActionError] = useState('');
  const addMessage = useChatStore((state) => state.addMessage);
  const afkTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const isAfkRef = useRef(false);
  const composerRef = useRef(null);

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
  } = useMessages(currentChat, composerRef);

  const otherUser =
    currentChat?.otherUser ||
    messages.find((m) => m.sender && m.sender.id !== user?.id)?.sender ||
    null;

  const chatTypeUpper = String(currentChat?.type || '').toUpperCase();
  const isPersonalSpace = chatTypeUpper === 'PERSONAL_SPACE';
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
    setPersonalSpaceActive(String(currentChat?.type || '').toUpperCase() === 'PERSONAL_SPACE');
  }, [currentChat?.id, currentChat?.type]);

  const syncChatIdInUrl = useCallback(
    (chatId) => {
      const next = new URLSearchParams(searchParams);
      if (chatId != null && chatId !== '') {
        next.set('chatId', String(chatId));
      } else {
        next.delete('chatId');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /** Open a chat in the store and keep the URL in sync so deep-link logic does not override selection. */
  const activateChat = useCallback(
    (chat) => {
      if (!chat) {
        setCurrentChat(null);
        syncChatIdInUrl(null);
        return;
      }
      setCurrentChat(chat);
      if (chat.id) {
        resetUnreadCount(chat.id);
        syncChatIdInUrl(chat.id);
      }
    },
    [setCurrentChat, resetUnreadCount, syncChatIdInUrl],
  );

  const openPersonalSpace = useCallback(async () => {
    try {
      const room = await chatService.getPersonalSpace();
      useChatStore.getState().upsertChat(room);
      activateChat(room);
      setUserSearchOpen(false);
      setSettingsOpen(false);
    } catch (err) {
      console.error('Failed to open personal space', err);
    }
  }, [activateChat]);

  const handleInsertRichMessage = useCallback(
    async (type) => {
      if (!currentChat?.id || richMessageSending) return;
      let payload;
      const upper = String(type || '').toUpperCase();
      switch (upper) {
        case 'TODO':
          payload = createTodoPayload();
          break;
        case 'STICKY_NOTE':
          payload = createStickyPayload({
            x: 40 + Math.floor(Math.random() * 120),
            y: 40 + Math.floor(Math.random() * 80),
          });
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
      currentChat?.id,
      replyToMessage?.id,
      richMessageSending,
      setComposerError,
      setReplyToMessage,
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
    setRoomActionLoading(true);
    setRoomActionError('');
    try {
      await chatService.deleteRoom(currentChat.id);
      clearRoomFromClient(currentChat.id);
    } catch (err) {
      setRoomActionError(err?.message || 'Failed to delete room');
    } finally {
      setRoomActionLoading(false);
    }
  }, [currentChat?.id, clearRoomFromClient]);

  const roomDisplayName = currentChat?.groupName || roomTypeLabel(currentChat);

  // Use the typing hook instead of direct store access
  const { isOtherUserTyping } = useTyping(currentChat, otherUser);

  const closeProfileDialog = () => {
    setProfileDialogOpen(false);
    setProfileDialogUser(null);
  };

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

  const handleSelectUserForNewChat = (selectedUser) => {
    if (!selectedUser) return;
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

  /** Apply chat from URL only when the query changes (notifications, invite links), not on every list click. */
  useEffect(() => {
    const requestedChatId = searchParams.get('chatId');
    if (!requestedChatId || !Array.isArray(chats) || chats.length === 0) {
      return;
    }
    const targetChat = chats.find((chat) => String(chat.id) === requestedChatId);
    if (!targetChat) {
      return;
    }
    const openId = useChatStore.getState().currentChat?.id;
    if (openId != null && String(openId) === requestedChatId) {
      return;
    }
    setCurrentChat(targetChat);
  }, [searchParams, chats, setCurrentChat]);

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
    } catch {
      /* invite may have expired */
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

      <MessageList
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
      />

      <UserProfileDialog
        open={profileDialogOpen && Boolean(profileDialogUser)}
        onClose={closeProfileDialog}
        user={profileDialogUser}
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
        onFolderViewChange={() => activateChat(null)}
        personalSpaceActive={personalSpaceActive}
        onPersonalSpaceSelect={() => void openPersonalSpace()}
        listPanel={({ chatFilter, activeFolderId }) => (
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
        )}
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
    </>
  );
};

export default ChatPage;