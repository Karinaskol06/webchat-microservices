import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import AddReactionOutlinedIcon from '@mui/icons-material/AddReactionOutlined';
import { chatColors } from '../../theme/chatDesignTokens';
import { QUICK_REACTION_EMOJIS, messageReactionEmojiSx } from '../../utils/messageReactions';

const MessageReactionQuickBar = ({ onPickEmoji, onOpenFullPicker, disabled = false }) => (
  <Box
    role="toolbar"
    aria-label="Quick reactions"
    onClick={(e) => e.stopPropagation()}
    onContextMenu={(e) => e.preventDefault()}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.25,
      px: 0.75,
      py: 0.5,
      flexWrap: 'nowrap',
    }}
  >
    {QUICK_REACTION_EMOJIS.map((emoji) => (
      <Tooltip key={emoji} title={`React with ${emoji}`} placement="top">
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={() => onPickEmoji?.(emoji)}
            aria-label={`React with ${emoji}`}
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              color: chatColors.textPrimary,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
            }}
          >
            <Box component="span" sx={messageReactionEmojiSx}>
              {emoji}
            </Box>
          </IconButton>
        </span>
      </Tooltip>
    ))}
    <Tooltip title="More emojis" placement="top">
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          onClick={() => onOpenFullPicker?.()}
          aria-label="More emojis"
          sx={{
            width: 36,
            height: 36,
            ml: 0.25,
            borderRadius: 2,
            color: chatColors.primaryLight,
            border: `1px solid ${chatColors.borderSubtle}`,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <AddReactionOutlinedIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  </Box>
);

export default MessageReactionQuickBar;
