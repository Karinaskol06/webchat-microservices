import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Typography,
  Box,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import useChatStore from '../../store/useChatStore';
import chatService from '../../services/chatService';
import { sendForwardMessage } from '../../utils/websocket';
import { parseQuotedSnippetFromMessage } from '../../utils/quotedMessagePreview';
import {
  getChatDisplayLabel,
  getChatDisplaySecondary,
  getChatTypeUpper,
  isRoomLikeChat,
} from '../../utils/chatDisplay';
import { QuotedKindIcon } from './QuotedKindIcon';
import UserAvatar from '../user/UserAvatar';
import { resolveRoomAvatarSrc } from '../../utils/userAvatar';

const ForwardChatDialog = ({ open, message, onClose, onActivateChat }) => {
  const chats = useChatStore((s) => s.chats);
  const [error, setError] = useState('');
  const [personalSpace, setPersonalSpace] = useState(null);

  useEffect(() => {
    if (!open) {
      setPersonalSpace(null);
      return undefined;
    }
    let cancelled = false;
    chatService
      .getPersonalSpace()
      .then((room) => {
        if (cancelled || !room?.id) return;
        useChatStore.getState().upsertChat(room);
        setPersonalSpace(room);
      })
      .catch(() => {
        if (!cancelled) setPersonalSpace(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectableChats = useMemo(() => {
    const list = Array.isArray(chats) ? chats.filter((c) => c?.id) : [];
    const psFromStore = list.find((c) => getChatTypeUpper(c) === 'PERSONAL_SPACE');
    const personal = personalSpace || psFromStore;
    const rest = list
      .filter((c) => getChatTypeUpper(c) !== 'PERSONAL_SPACE')
      .sort((a, b) =>
        getChatDisplayLabel(a).localeCompare(getChatDisplayLabel(b), undefined, {
          sensitivity: 'base',
        }),
      );
    return personal ? [personal, ...rest] : rest;
  }, [chats, personalSpace]);

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

    onActivateChat?.(chat);

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
              const label = getChatDisplayLabel(chat);
              const roomLike = isRoomLikeChat(chat);
              const letter = (label?.[0] || '?').toUpperCase();
              const roomAvatarSrc = roomLike ? resolveRoomAvatarSrc(chat) : undefined;
              return (
                <ListItemButton key={chat.id} onClick={() => handleSelectChat(chat)}>
                  <ListItemAvatar>
                    {roomLike ? (
                      <UserAvatar src={roomAvatarSrc} letter={letter} />
                    ) : (
                      <UserAvatar user={chat.otherUser} />
                    )}
                  </ListItemAvatar>
                  <ListItemText
                    primary={label}
                    secondary={getChatDisplaySecondary(chat)}
                  />
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
