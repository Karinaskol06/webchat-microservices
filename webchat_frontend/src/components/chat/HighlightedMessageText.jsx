import React, { useMemo } from 'react';
import { Box, Link } from '@mui/material';
import { chatColors, themePrimaryAlpha } from '../../theme/chatDesignTokens';
import { parseLinkSegments } from '../../utils/linkifyMessageText';
import { messageLinkSx } from './LinkifiedMessageText';

/**
 * Renders text with optional substring highlights (case-insensitive match positions).
 */
const renderLinkifiedChunk = (chunk, keyPrefix) => {
  const segments = parseLinkSegments(chunk);
  if (segments.length === 1 && segments[0].type === 'text') {
    return chunk;
  }

  return segments.map((segment, index) => {
    if (segment.type === 'link') {
      return (
        <Link
          key={`${keyPrefix}-link-${index}`}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={messageLinkSx}
          onClick={(event) => event.stopPropagation()}
        >
          {segment.value}
        </Link>
      );
    }

    return <span key={`${keyPrefix}-text-${index}`}>{segment.value}</span>;
  });
};

const HighlightedMessageText = ({
  text = '',
  ranges = [],
  activeRange = null,
  ...typographyProps
}) => {
  const nodes = useMemo(() => {
    const value = String(text ?? '');
    if (!ranges.length) return renderLinkifiedChunk(value, 'full');

    const sorted = [...ranges]
      .filter((r) => r && r.end > r.start && r.start >= 0 && r.end <= value.length)
      .sort((a, b) => a.start - b.start);

    if (!sorted.length) return renderLinkifiedChunk(value, 'full');

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
        parts.push(
          <span key={`t-${cursor}`}>{renderLinkifiedChunk(value.slice(cursor, start), `t-${cursor}`)}</span>,
        );
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
      parts.push(
        <span key={`t-${cursor}-end`}>{renderLinkifiedChunk(value.slice(cursor), `t-${cursor}-end`)}</span>,
      );
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
