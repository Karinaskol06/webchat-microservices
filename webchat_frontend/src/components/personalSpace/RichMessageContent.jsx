import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { parseRichPayload } from '../../utils/personalSpace';
import TodoListMessage from './TodoListMessage';
import StickyNoteMessage from './StickyNoteMessage';
import CalloutMessage from './CalloutMessage';

import PollMessage from '../chat/PollMessage';

const RichMessageContent = ({
  message,
  editable = false,
  onUpdate,
  onDelete,
  floatingSticky = false,
  onStickyDragEnd,
  currentUserId,
}) => {
  const { type, data } = useMemo(() => parseRichPayload(message), [message]);
  const messageId = message?.id ?? message?._id;

  if (type === 'STICKY_NOTE' && floatingSticky) {
    return null;
  }

  const common = { payload: data, editable, onUpdate, onDelete, messageId };

  const isTodo = type === 'TODO';

  return (
    <Box
      sx={{
        width: isTodo ? 'max-content' : '100%',
        maxWidth: '100%',
        display: 'flex',
        justifyContent: 'flex-start',
      }}
    >
      {isTodo && <TodoListMessage {...common} />}
      {type === 'STICKY_NOTE' && (
        <StickyNoteMessage
          {...common}
          floating={floatingSticky}
          onDragEnd={onStickyDragEnd}
        />
      )}
      {type === 'CALLOUT' && <CalloutMessage {...common} />}
      {type === 'POLL' && (
        <PollMessage
          payload={data}
          messageId={messageId}
          currentUserId={currentUserId}
        />
      )}
    </Box>
  );
};

export default RichMessageContent;
