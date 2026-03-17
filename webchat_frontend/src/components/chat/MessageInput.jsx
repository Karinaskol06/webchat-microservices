import React from 'react';
import { Box, IconButton, Paper, TextField, Tooltip } from '@mui/material';
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
  emojiSidebarOpen,
  onToggleEmojiSidebar,
}) => {
  const handleChange = (e) => {
    onChange?.(e.target.value);
    onTyping?.();
  };

  return (
    <Paper sx={{ p: 2, borderRadius: 0 }}>
      <Box display="flex" alignItems="center">
        <IconButton>
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
          disabled={!value.trim()}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
};

export default MessageInput;

