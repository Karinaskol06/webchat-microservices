import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Box,
  Typography,
} from '@mui/material';
import ChatShell from '../components/layout/ChatShell';
import ChatInfoSidebar from '../components/chat/ChatInfoSidebar';
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
import { findInChatMessageMatches } from '../utils/chatMessageSearch';
import useWebSocket from '../hooks/useWebSocket';
import useMessages from '../hooks/useMessages';
import { useUnreadMessageSeparator } from '../hooks/useUnreadMessageSeparator';
import useTyping from '../hooks/useTyping'; 
import { useShallow } from 'zustand/react/shallow';
import contactsService from '../services/contactsService';
import { useSearchParams } from 'react-router-dom';
import { channelPostingRestricted } from '../utils/channelPermissions';

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
  const afkTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const isAfkRef = useRef(false);
  const composerRef = useRef(null);
  
  const otherUser =
    currentChat?.otherUser ||
    messages.find((m) => m.sender && m.sender.id !== user?.id)?.sender ||
    null;

  const chatTypeUpper = String(currentChat?.type || '').toUpperCase();
  const isGroupOrChannel = chatTypeUpper === 'GROUP' || chatTypeUpper === 'CHANNEL';

  const headerTitle = useMemo(() => {
    if (!isGroupOrChannel) return undefined;
    if (chatTypeUpper === 'CHANNEL') return currentChat?.groupName || 'Channel';
    return currentChat?.groupName || 'Group chat';
  }, [isGroupOrChannel, chatTypeUpper, currentChat?.groupName]);

  const headerSubtitle = useMemo(() => {
    if (!isGroupOrChannel) return undefined;
    const vis = String(currentChat?.visibility || '').toUpperCase();
    const kind = chatTypeUpper === 'CHANNEL' ? 'Channel' : 'Group';
    const visLabel = vis === 'PUBLIC' ? 'Public' : 'Private';
    const mc = currentChat?.memberCount;
    const countPart = typeof mc === 'number' ? ` · ${mc} members` : '';
    return `${kind} · ${visLabel}${countPart}`;
  }, [isGroupOrChannel, chatTypeUpper, currentChat?.visibility, currentChat?.memberCount]);

  const headerAvatarSrc = isGroupOrChannel ? currentChat?.groupPhoto : undefined;
  const { openSeparatorIndex, liveBeforeMessageId, scrollToMessageId } =
    useUnreadMessageSeparator({
      userId: user?.id,
      chatId: currentChat?.id,
      chatUnreadCount: currentChat?.unreadCount,
      messages,
    });

  const headerAvatarLetter = useMemo(() => {
    if (!isGroupOrChannel) return undefined;
    const n = currentChat?.groupName;
    return (n?.[0] || (chatTypeUpper === 'CHANNEL' ? 'C' : 'G')).toUpperCase();
  }, [isGroupOrChannel, chatTypeUpper, currentChat?.groupName]);

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

  // Use the typing hook instead of direct store access
  const { isOtherUserTyping } = useTyping(currentChat, otherUser);

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

  const [messageToForward, setMessageToForward] = useState(null);

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

  useEffect(() => {
    const requestedChatId = searchParams.get('chatId');
    if (!requestedChatId || !Array.isArray(chats) || chats.length === 0) {
      return;
    }
    if (String(currentChat?.id) === requestedChatId) {
      return;
    }
    const targetChat = chats.find((chat) => String(chat.id) === requestedChatId);
    if (targetChat) {
      setCurrentChat(targetChat);
    }
  }, [searchParams, chats, currentChat?.id, setCurrentChat]);

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
        setCurrentChat(dto);
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

  const roomInviteBannerLabel = (invite) => {
    const inviter = invite?.invitedBy;
    const inviterName =
      inviter?.username ||
      [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ') ||
      'Someone';
    const roomLabel = invite?.roomName || (invite?.roomType === 'CHANNEL' ? 'a channel' : 'a group');
    return `${inviterName} invited you to join ${roomLabel}`;
  };

  const handleJoinedRoom = useCallback((dto) => {
    if (!dto?.id) return;
    useChatStore.getState().upsertChat(dto);
    setCurrentChat(dto);
    setUserSearchOpen(false);
    setSettingsOpen(false);
  }, [setCurrentChat]);

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
    if (currentChat?.id && isGroupOrChannel) {
      openRoomProfileById(currentChat.id);
    }
  }, [currentChat?.id, isGroupOrChannel, openRoomProfileById]);

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
          onOpenProfile={isGroupOrChannel ? openRoomProfileFromHeader : openPartnerProfile}
          onShowEmojiSidebar={() => setEmojiSidebarOpen(true)}
          headerTitle={headerTitle}
          headerSubtitle={headerSubtitle}
          headerAvatarSrc={headerAvatarSrc}
          headerAvatarLetter={headerAvatarLetter}
          headerAvatarClickable={isGroupOrChannel || Boolean(otherUser)}
          showCopyInvite={showCopyRoomInvite}
          onCopyInvite={handleCopyRoomInvite}
          isGroupOrChannel={isGroupOrChannel}
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

      {roomMemberInvites.length > 0
        ? roomMemberInvites.map((invite) => (
            <Alert
              key={invite.id}
              severity="info"
              sx={{ mx: 2, mt: 1, borderRadius: 3 }}
              action={
                <>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void handleAcceptRoomMemberInvite(invite)}
                    disabled={roomInviteActionLoading}
                  >
                    Join
                  </Button>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void handleDeclineRoomMemberInvite(invite)}
                    disabled={roomInviteActionLoading}
                  >
                    Decline
                  </Button>
                </>
              }
            >
              {roomInviteBannerLabel(invite)}
            </Alert>
          ))
        : null}

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
        onBackFromChat={() => setCurrentChat(null)}
        onOpenProfile={() => setMyProfileOpen(true)}
        onOpenSettings={() => {
          setSettingsDialogVariant('settings');
          setSettingsOpen(true);
        }}
        settingsOpen={settingsOpen}
        onFindUsers={() => setUserSearchOpen(true)}
        findUsersOpen={userSearchOpen}
        onFolderViewChange={() => setCurrentChat(null)}
        showInfoPanel={Boolean(currentChat && isGroupOrChannel)}
        infoPanel={
          <ChatInfoSidebar room={currentChat} onOpenRoomProfile={openRoomProfileFromHeader} />
        }
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
      />

      <RoomProfileDialog open={roomProfileOpen} roomId={roomProfileId} onClose={closeRoomProfile} />
    </>
  );
};

export default ChatPage;