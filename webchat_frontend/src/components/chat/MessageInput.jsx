import React, { useRef } from 'react';
import { Alert, Box, Chip, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CloseIcon from '@mui/icons-material/Close';
import { parseQuotedSnippetFromMessage } from '../../utils/quotedMessagePreview';
import { QuotedKindIcon } from './QuotedKindIcon';

const MessageInput = ({
  value,
  onChange,
  onSend,
  onTyping,
  onKeyPress,
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
}) => {
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    onDismissComposerError?.();
    onChange?.(e.target.value);
    onTyping?.();
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = (e) => {
    const files = e.target.files;
    onSelectAttachments?.(files);
    e.target.value = '';
  };

  const hasText = Boolean(value?.trim());
  const canSend = !channelReadOnly && (hasText || attachments.length > 0);

  const replyAuthor =
    replyToMessage?.sender?.firstName ||
    replyToMessage?.sender?.username ||
    'User';

  const quotedComposer = replyToMessage ? parseQuotedSnippetFromMessage(replyToMessage) : null;

  return (
    <Paper sx={{ p: 2, borderRadius: 0 }}>
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
        <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
          {channelReadOnlyHint}
        </Typography>
      ) : (
        <Box display="flex" alignItems="center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFileSelection}
            accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,image/*,video/*"
          />
          <IconButton onClick={handleOpenFilePicker}>
            <AttachFileIcon />
          </IconButton>

          <Tooltip title={emojiSidebarOpen ? 'Hide emoji sidebar' : 'Show emoji sidebar'}>
            <IconButton onClick={onToggleEmojiSidebar}>
              {emojiSidebarOpen ? <ChevronLeftIcon /> : <EmojiEmotionsOutlinedIcon />}
            </IconButton>
          </Tooltip>

          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Write a message..."
            value={value}
            onChange={handleChange}
            onKeyPress={onKeyPress}
            sx={{
              mx: 1,
              '& .MuiInputBase-input': {
                fontFamily:
                  'inherit, system-ui, "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
              },
            }}
            inputRef={inputRef}
          />

          <IconButton color="primary" onClick={onSend} disabled={!canSend}>
            <SendIcon />
          </IconButton>
        </Box>
      )}
    </Paper>
  );
};

export default MessageInput;

