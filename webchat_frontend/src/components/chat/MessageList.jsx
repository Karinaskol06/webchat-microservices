import React, { memo } from 'react';
import { Box } from '@mui/material';
import MessageItem from './MessageItem';

const MessageList = ({ messages, currentUserId, messagesEndRef }) => {
  const safeMessages = Array.isArray(messages) ? messages : [];
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        p: 2,
        bgcolor: '#f5f5f5',
      }}
    >
      {safeMessages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          currentUserId={currentUserId}
        />
      ))}
      <div ref={messagesEndRef} />
    </Box>
  );
};

export default memo(MessageList);

