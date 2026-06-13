import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { chatColors, themePrimaryAlpha } from '../../theme/chatDesignTokens';

/**
 * Renders text with optional substring highlights (case-insensitive match positions).
 */
const HighlightedMessageText = ({
  text = '',
  ranges = [],
  activeRange = null,
  ...typographyProps
}) => {
  const nodes = useMemo(() => {
    const value = String(text ?? '');
    if (!ranges.length) return value;

    const sorted = [...ranges]
      .filter((r) => r && r.end > r.start && r.start >= 0 && r.end <= value.length)
      .sort((a, b) => a.start - b.start);

    if (!sorted.length) return value;

    const parts = [];
    let cursor = 0;

    const isActive = (range) =>
      activeRange &&
      activeRange.start === range.start &&
      activeRange.end === range.end;

    for (const range of sorted) {
      const start = Math.max(range.start, cursor);
      const end = Math.min(range.end, value.length);
      if (end <= start) continue;

      if (start > cursor) {
        parts.push(<span key={`t-${cursor}`}>{value.slice(cursor, start)}</span>);
      }

      const active = isActive(range);
      parts.push(
        <Box
          key={`h-${start}-${end}`}
          component="mark"
          sx={{
            bgcolor: (theme) =>
              active ? theme.palette.primary.main : themePrimaryAlpha(theme, 0.28),
            color: active ? chatColors.textOnPrimary : 'inherit',
            borderRadius: '3px',
            px: 0.15,
            font: 'inherit',
          }}
        >
          {value.slice(start, end)}
        </Box>,
      );
      cursor = end;
    }

    if (cursor < value.length) {
      parts.push(<span key={`t-${cursor}-end`}>{value.slice(cursor)}</span>);
    }

    return parts;
  }, [text, ranges, activeRange]);

  return (
    <Box
      component="span"
      sx={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...typographyProps.sx,
      }}
    >
      {nodes}
    </Box>
  );
};

export default HighlightedMessageText;
