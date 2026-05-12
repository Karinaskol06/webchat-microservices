import React, { useMemo, useState } from 'react';
import {
  Alert,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Box,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import useChatStore from '../../store/useChatStore';
import { sendForwardMessage } from '../../utils/websocket';
import { parseQuotedSnippetFromMessage } from '../../utils/quotedMessagePreview';
import { QuotedKindIcon } from './QuotedKindIcon';

const chatLabel = (chat) => {
  const isGroup = String(chat?.type || '').toUpperCase() === 'GROUP';
  if (isGroup) {
    return chat.groupName || 'Group chat';
  }
  const u = chat.otherUser;
  if (u?.firstName || u?.lastName) {
    return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  }
  return u?.username || 'Chat';
};

const ForwardChatDialog = ({ open, message, onClose }) => {
  const chats = useChatStore((s) => s.chats);
  const setCurrentChat = useChatStore((s) => s.setCurrentChat);
  const resetUnreadCount = useChatStore((s) => s.resetUnreadCount);
  const [error, setError] = useState('');

  const selectableChats = useMemo(() => {
    const list = Array.isArray(chats) ? chats : [];
    return list.filter((c) => c?.id);
  }, [chats]);

  const preview = message ? parseQuotedSnippetFromMessage(message) : null;
  const previewAuthor =
    message?.sender?.firstName ||
    message?.sender?.username ||
    'User';

  const handleSelectChat = (chat) => {
    if (!message?.id || !chat?.id) return;
    setError('');
    const targetChatId = String(chat.id);
    const sourceMessageId = String(message.id);

    // Open destination chat first so the live store matches the topic when the forwarded
    // message arrives (see useWebSocket message handler).
    setCurrentChat(chat);
    resetUnreadCount(targetChatId);

    const ok = sendForwardMessage({
      chatId: targetChatId,
      forwardSourceMessageId: sourceMessageId,
    });
    if (!ok) {
      setError('Not connected. Wait for the connection to recover, then try again.');
      return;
    }
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Forward to…</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {message && (
          <Box
            sx={{
              mb: 2,
              p: 1.25,
              borderRadius: 1,
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
              border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Message will be sent as-is (including attachments).
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
              {previewAuthor}
            </Typography>
            {preview && preview.kind !== 'deleted' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, minWidth: 0 }}>
                {preview.kind !== 'text' && <QuotedKindIcon kind={preview.kind} />}
                <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
                  {preview.subtitle}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {error ? (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>
            {error}
          </Alert>
        ) : null}

        {selectableChats.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No chats yet. Start a conversation first.
          </Typography>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 360, overflow: 'auto' }}>
            {selectableChats.map((chat) => {
              const label = chatLabel(chat);
              const letter = label?.[0]?.toUpperCase() || '?';
              const isGroup = String(chat.type || '').toUpperCase() === 'GROUP';
              const avatarSrc = !isGroup ? chat.otherUser?.profilePicture : undefined;
              return (
                <ListItemButton key={chat.id} onClick={() => handleSelectChat(chat)}>
                  <ListItemAvatar>
                    <Avatar src={avatarSrc}>{letter}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={label} secondary={isGroup ? 'Group' : chat.otherUser?.username} />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForwardChatDialog;
