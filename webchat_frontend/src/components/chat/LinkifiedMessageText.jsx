import React, { useMemo } from 'react';
import { Link } from '@mui/material';
import { chatColors } from '../../theme/chatDesignTokens';
import { parseLinkSegments } from '../../utils/linkifyMessageText';

export const messageLinkSx = {
  color: chatColors.accentBlue,
  fontWeight: 500,
  textDecorationColor: 'rgba(76, 141, 255, 0.45)',
  wordBreak: 'break-all',
  '&:hover': {
    color: chatColors.accentBlue,
    textDecorationColor: chatColors.accentBlue,
  },
};

const LinkifiedMessageText = ({ text = '', linkSx = messageLinkSx }) => {
  const nodes = useMemo(() => {
    const segments = parseLinkSegments(text);
    if (segments.length === 1 && segments[0].type === 'text') {
      return segments[0].value;
    }

    return segments.map((segment, index) => {
      if (segment.type === 'link') {
        return (
          <Link
            key={`link-${index}-${segment.href}`}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={linkSx}
            onClick={(event) => event.stopPropagation()}
          >
            {segment.value}
          </Link>
        );
      }

      return <span key={`text-${index}`}>{segment.value}</span>;
    });
  }, [text, linkSx]);

  return <>{nodes}</>;
};

export default LinkifiedMessageText;
