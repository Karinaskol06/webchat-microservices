import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { parseRichPayload } from '../../utils/personalSpace';
import TodoListMessage from './TodoListMessage';
import StickyNoteMessage from './StickyNoteMessage';
import CalloutMessage from './CalloutMessage';

const RichMessageContent = ({
  message,
  editable = false,
  onUpdate,
  onDelete,
  floatingSticky = false,
  onStickyDragEnd,
}) => {
  const { type, data } = useMemo(() => parseRichPayload(message), [message]);
  const messageId = message?.id ?? message?._id;

  if (type === 'STICKY_NOTE' && floatingSticky) {
    return null;
  }

  const common = { payload: data, editable, onUpdate, onDelete, messageId };

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'flex-start',
      }}
    >
      {type === 'TODO' && <TodoListMessage {...common} />}
      {type === 'STICKY_NOTE' && (
        <StickyNoteMessage
          {...common}
          floating={floatingSticky}
          onDragEnd={onStickyDragEnd}
        />
      )}
      {type === 'CALLOUT' && <CalloutMessage {...common} />}
    </Box>
  );
};

export default RichMessageContent;
