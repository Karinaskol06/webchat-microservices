import React, { useRef } from 'react';
import { Box, Chip, IconButton, Paper, TextField, Tooltip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

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
  emojiSidebarOpen,
  onToggleEmojiSidebar,
}) => {
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
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
  const canSend = hasText || attachments.length > 0;

  return (
    <Paper sx={{ p: 2, borderRadius: 0 }}>
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
          sx={{ mx: 1 }}
          inputRef={inputRef}
        />

        <IconButton
          color="primary"
          onClick={onSend}
          disabled={!canSend}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default MessageInput;

