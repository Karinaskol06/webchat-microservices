import React from 'react';
import { Avatar, Box, Paper, Typography } from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';

const MessageItem = ({ message, currentUserId }) => {
  const sender = message.sender;
  const isOwn = sender?.id === currentUserId;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
        mb: 2,
      }}
    >
      {!isOwn && (
        <Avatar
          sx={{ mr: 1 }}
          src={sender?.profilePicture || undefined}
        >
          {(sender?.firstName?.[0] ||
            sender?.username?.[0] ||
            'U'
          ).toUpperCase()}
        </Avatar>
      )}

      <Paper
        sx={{
          p: 1.5,
          maxWidth: '70%',
          bgcolor: isOwn ? '#e3f2fd' : 'white',
        }}
      >
        <Typography variant="body1">{message.content}</Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            mt: 0.5,
            gap: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {new Date(message.timestamp).toLocaleTimeString()}
          </Typography>
          {isOwn &&
            (message.isRead ? (
              <DoneAllIcon
                fontSize="small"
                sx={{ color: 'success.main' }}
              />
            ) : (
              <DoneIcon
                fontSize="small"
                sx={{ color: 'grey.500' }}
              />
            ))}
        </Box>
      </Paper>

      {isOwn && (
        <Avatar
          sx={{ ml: 1 }}
          src={sender?.profilePicture || undefined}
        >
          {(sender?.firstName?.[0] ||
            sender?.username?.[0] ||
            'U'
          ).toUpperCase()}
        </Avatar>
      )}
    </Box>
  );
};

export default MessageItem;

