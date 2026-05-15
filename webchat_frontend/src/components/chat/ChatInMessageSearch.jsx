import React from 'react';
import {
  Box,
  Collapse,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import { chatColors, chatGlassFieldSx } from '../../theme/chatDesignTokens';

const ChatInMessageSearch = ({
  open,
  query,
  onQueryChange,
  matchCount,
  activeMatchIndex,
  onPrevMatch,
  onNextMatch,
  onClose,
}) => {
  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const safeIndex =
    matchCount === 0 ? -1 : Math.min(Math.max(activeMatchIndex, 0), matchCount - 1);

  const statusLabel = !hasQuery
    ? 'Type to search messages'
    : matchCount === 0
      ? 'No matches'
      : `${safeIndex + 1} of ${matchCount}`;

  return (
    <Collapse in={open} unmountOnExit>
      <Box
        sx={{
          flexShrink: 0,
          px: { xs: 1.5, sm: 2.5 },
          py: 1,
          borderBottom: `1px solid ${chatColors.borderSubtle}`,
          bgcolor: chatColors.conversationBg,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="Search in this chat"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) onPrevMatch?.();
                else onNextMatch?.();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: chatColors.textSecondary, fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={chatGlassFieldSx}
            inputProps={{ 'aria-label': 'Search in this chat' }}
          />
          <IconButton
            aria-label="Previous match"
            size="small"
            onClick={onPrevMatch}
            disabled={!hasQuery || matchCount === 0}
            sx={{ color: chatColors.textPrimary }}
          >
            <KeyboardArrowUpIcon />
          </IconButton>
          <IconButton
            aria-label="Next match"
            size="small"
            onClick={onNextMatch}
            disabled={!hasQuery || matchCount === 0}
            sx={{ color: chatColors.textPrimary }}
          >
            <KeyboardArrowDownIcon />
          </IconButton>
          <Typography
            variant="caption"
            sx={{ minWidth: 56, textAlign: 'center', color: chatColors.textSecondary }}
          >
            {statusLabel}
          </Typography>
          <IconButton
            aria-label="Close search"
            size="small"
            onClick={onClose}
            sx={{ color: chatColors.textPrimary }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Collapse>
  );
};

export default ChatInMessageSearch;
