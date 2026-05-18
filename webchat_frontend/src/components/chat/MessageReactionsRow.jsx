import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { chatColors } from '../../theme/chatDesignTokens';
import { messageReactionEmojiSx, normalizeReactions } from '../../utils/messageReactions';

const MessageReactionsRow = ({ reactions, currentUserId, onToggleReaction }) => {
  const items = normalizeReactions(reactions, currentUserId);
  if (items.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        mt: 0.75,
        mb: 0.25,
      }}
    >
      {items.map((reaction) => {
        const label =
          reaction.count === 1
            ? `1 reaction: ${reaction.emoji}`
            : `${reaction.count} reactions: ${reaction.emoji}`;
        return (
          <Tooltip key={reaction.emoji} title={label} placement="top">
            <Chip
              size="small"
              label={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <Box component="span" sx={{ ...messageReactionEmojiSx, fontSize: '1rem' }}>
                    {reaction.emoji}
                  </Box>
                  {reaction.count > 1 ? (
                    <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {reaction.count}
                    </Box>
                  ) : null}
                </Box>
              }
              onClick={() => onToggleReaction?.(reaction.emoji)}
              aria-label={`${reaction.reactedByMe ? 'Remove' : 'Add'} reaction ${reaction.emoji}`}
              sx={{
                height: 28,
                cursor: 'pointer',
                bgcolor: reaction.reactedByMe
                  ? 'rgba(124, 58, 237, 0.35)'
                  : 'rgba(255, 255, 255, 0.1)',
                border: reaction.reactedByMe
                  ? `1px solid ${chatColors.primaryLight}`
                  : '1px solid rgba(255,255,255,0.12)',
                color: chatColors.bubbleText,
                '& .MuiChip-label': { px: 0.75 },
                '&:hover': {
                  bgcolor: reaction.reactedByMe
                    ? 'rgba(124, 58, 237, 0.45)'
                    : 'rgba(255, 255, 255, 0.16)',
                },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default MessageReactionsRow;
