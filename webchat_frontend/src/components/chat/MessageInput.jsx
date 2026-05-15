import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Box, Chip, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloseIcon from '@mui/icons-material/Close';
import { parseQuotedSnippetFromMessage } from '../../utils/quotedMessagePreview';
import { QuotedKindIcon } from './QuotedKindIcon';
import { chatColors, chatRadii } from '../../theme/chatDesignTokens';

const TYPING_NOTIFY_MS = 400;

const MessageInput = forwardRef(function MessageInput(
  {
    chatId,
    onSend,
    onTyping,
    inputRef,
    attachments = [],
    onSelectAttachments,
    onRemoveAttachment,
    replyToMessage,
    onCancelReply,
    emojiSidebarOpen,
    onToggleEmojiSidebar,
    composerError,
    onDismissComposerError,
    channelReadOnly = false,
    channelReadOnlyHint = 'Only the channel owner or admins can post in this channel.',
  },
  ref,
) {
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState('');
  const lastTypingNotifyRef = useRef(0);

  useEffect(() => {
    setDraft('');
    lastTypingNotifyRef.current = 0;
  }, [chatId]);

  useImperativeHandle(
    ref,
    () => ({
      getDraft: () => draft,
      setDraft: (text) => setDraft(text ?? ''),
      appendText: (text) => {
        if (!text) return;
        setDraft((prev) => `${prev}${text}`);
      },
      clear: () => setDraft(''),
    }),
    [draft],
  );

  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTypingNotifyRef.current < TYPING_NOTIFY_MS) return;
    lastTypingNotifyRef.current = now;
    onTyping?.();
  };

  const handleChange = (e) => {
    onDismissComposerError?.();
    setDraft(e.target.value);
    notifyTyping();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (channelReadOnly) return;
    const text = draft;
    const hasText = Boolean(text.trim());
    const hasAttachments = attachments.length > 0;
    if (!hasText && !hasAttachments) return;

    setDraft('');
    onSend?.(text);
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = (e) => {
    const files = e.target.files;
    onSelectAttachments?.(files);
    e.target.value = '';
  };

  const hasText = Boolean(draft.trim());
  const canSend = !channelReadOnly && (hasText || attachments.length > 0);

  const replyAuthor =
    replyToMessage?.sender?.firstName ||
    replyToMessage?.sender?.username ||
    'User';

  const quotedComposer = replyToMessage ? parseQuotedSnippetFromMessage(replyToMessage) : null;

  return (
    <Box
      sx={{
        flexShrink: 0,
        px: { xs: 1.5, sm: 2.5 },
        py: 2,
        borderTop: `1px solid ${chatColors.borderSubtle}`,
        bgcolor: chatColors.conversationBg,
      }}
    >
      {composerError ? (
        <Alert severity="error" onClose={onDismissComposerError} sx={{ mb: 1.5 }}>
          {composerError}
        </Alert>
      ) : null}
      {replyToMessage && !channelReadOnly && quotedComposer && quotedComposer.kind !== 'deleted' && (
        <Box
          sx={{
            display: 'flex',
            mb: 1.25,
            minHeight: 40,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: (theme) => alpha(theme.palette.primary.dark, 0.1),
          }}
        >
          <Box
            sx={{
              width: 3,
              flexShrink: 0,
              bgcolor: 'primary.main',
            }}
          />
          <Box
            sx={{
              flex: 1,
              py: 0.625,
              pl: 0.875,
              pr: 0.25,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 0.5,
              minWidth: 0,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: 'primary.dark',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {replyAuthor}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, minWidth: 0, mt: 0.125 }}>
                {quotedComposer.kind !== 'text' && <QuotedKindIcon kind={quotedComposer.kind} />}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    ...(quotedComposer.kind === 'text' && {
                      whiteSpace: 'normal',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                    }),
                  }}
                >
                  {quotedComposer.subtitle}
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={onCancelReply} aria-label="Cancel reply">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}
      {attachments.length > 0 && (
        <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
          {attachments.map((file, index) => (
            <Chip
              key={`${file.name}-${index}`}
              label={file.name}
              onDelete={() => onRemoveAttachment?.(index)}
              size="small"
            />
          ))}
        </Box>
      )}
      {channelReadOnly ? (
        <Typography variant="body2" sx={{ py: 0.5, color: chatColors.textSecondary }}>
          {channelReadOnlyHint}
        </Typography>
      ) : (
        <Box
          display="flex"
          alignItems="flex-end"
          sx={{
            bgcolor: chatColors.composerInputBg,
            borderRadius: `${chatRadii.pill}px`,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            px: 0.5,
            py: 0.5,
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            '&:focus-within': {
              borderColor: 'rgba(255, 255, 255, 0.22)',
              boxShadow: '0 0 0 2px rgba(155, 135, 255, 0.2)',
            },
            '& .MuiIconButton-root': { color: 'rgba(255,255,255,0.85)' },
            '& .MuiInputBase-input': { color: '#fff' },
            '& .MuiInputBase-input::placeholder': {
              color: 'rgba(255,255,255,0.5)',
              opacity: 1,
            },
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFileSelection}
            accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,image/*,video/*"
          />
          <IconButton onClick={handleOpenFilePicker} aria-label="Attach file" size="small">
            <AttachFileIcon />
          </IconButton>

          <Tooltip title={emojiSidebarOpen ? 'Hide emoji sidebar' : 'Show emoji sidebar'}>
            <IconButton onClick={onToggleEmojiSidebar} aria-label="Toggle emoji picker" size="small">
              {emojiSidebarOpen ? <ChevronLeftIcon /> : <EmojiEmotionsOutlinedIcon />}
            </IconButton>
          </Tooltip>

          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Your message"
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            variant="standard"
            InputProps={{ disableUnderline: true }}
            sx={{
              mx: 0.5,
              '& .MuiInputBase-root': { fontSize: '0.9375rem' },
              '& .MuiInputBase-input': {
                fontFamily:
                  'inherit, system-ui, "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
              },
            }}
            inputRef={inputRef}
          />

          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            size="small"
            sx={{
              bgcolor: canSend ? chatColors.primary : 'transparent',
              color: canSend ? '#fff' : 'action.disabled',
              '&:hover': { bgcolor: canSend ? chatColors.primaryDark : undefined },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
});

export default MessageInput;
