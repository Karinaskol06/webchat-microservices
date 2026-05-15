import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AuthenticatedImage from './AuthenticatedImage';
import { useChatAreaMetrics } from '../../context/ChatAreaMetricsContext';
import { computeChatImageDisplaySize } from '../../utils/chatImageLayout';
import { chatColors } from '../../theme/chatDesignTokens';

const IMAGE_RADIUS = 10;

/**
 * Chat image — natural aspect ratio, tight corners, sized to the chat viewport.
 */
const ChatImageAttachment = ({
  attachment,
  onOpen,
  timestamp,
  isOwn = false,
  isRead = false,
  /** When true, only top corners are rounded (image stacked above a text caption). */
  attachCaptionBelow = false,
}) => {
  const { width: chatAreaWidth, height: chatAreaHeight } = useChatAreaMetrics();
  const borderRadius = attachCaptionBelow ? '10px 10px 0 0' : `${IMAGE_RADIUS}px`;
  const [loaded, setLoaded] = useState(false);
  const [displaySize, setDisplaySize] = useState(null);
  const naturalSizeRef = useRef({ width: 0, height: 0 });

  const applyDisplaySize = useCallback(
    (naturalWidth, naturalHeight) => {
      const next = computeChatImageDisplaySize(
        naturalWidth,
        naturalHeight,
        chatAreaWidth,
        chatAreaHeight,
      );
      setDisplaySize(next);
    },
    [chatAreaWidth, chatAreaHeight],
  );

  const handleImageLoad = useCallback(
    (event) => {
      setLoaded(true);
      const img = event?.currentTarget;
      if (img?.naturalWidth && img?.naturalHeight) {
        naturalSizeRef.current = { width: img.naturalWidth, height: img.naturalHeight };
        applyDisplaySize(img.naturalWidth, img.naturalHeight);
      }
    },
    [applyDisplaySize],
  );

  useEffect(() => {
    const { width, height } = naturalSizeRef.current;
    if (width > 0 && height > 0) {
      applyDisplaySize(width, height);
    }
  }, [chatAreaWidth, chatAreaHeight, applyDisplaySize]);

  const frameWidth = displaySize?.width;
  const frameHeight = displaySize?.height;

  return (
    <Box
      component="button"
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onOpen?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.();
        }
      }}
      aria-label={attachment?.filename ? `Open image ${attachment.filename}` : 'Open image'}
      sx={{
        display: 'block',
        position: 'relative',
        width: frameWidth ? `${frameWidth}px` : 'auto',
        maxWidth: chatAreaWidth > 0 ? chatAreaWidth * 0.5 : '50%',
        height: frameHeight ? `${frameHeight}px` : 'auto',
        maxHeight: chatAreaHeight > 0 ? chatAreaHeight * 0.8 : '80%',
        p: 0,
        border: 0,
        cursor: 'pointer',
        borderRadius,
        overflow: 'hidden',
        bgcolor: 'rgba(0,0,0,0.04)',
        lineHeight: 0,
        textAlign: 'left',
        flexShrink: 0,
        '&:hover': { opacity: 0.96 },
        '&:focus-visible': {
          outline: `2px solid ${chatColors.primary}`,
          outlineOffset: 2,
        },
      }}
    >
      <AuthenticatedImage
        attachmentId={attachment.id}
        alt={attachment.filename || 'Image'}
        onLoad={handleImageLoad}
        sx={{
          display: 'block',
          width: frameWidth ? `${frameWidth}px` : '100%',
          height: frameHeight ? `${frameHeight}px` : 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          verticalAlign: 'bottom',
        }}
      />

      {!loaded && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 120,
            minWidth: 120,
            bgcolor: 'rgba(0,0,0,0.04)',
          }}
        >
          <CircularProgress size={28} sx={{ color: chatColors.primary }} />
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 22,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          gap: 0.5,
          px: 0.75,
          pb: 0.35,
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.42) 55%, rgba(0,0,0,0.62) 100%)',
          pointerEvents: 'none',
        }}
      >
        {timestamp ? (
          <Box
            component="span"
            sx={{ fontSize: '0.65rem', fontWeight: 500, color: '#fff', lineHeight: 1 }}
          >
            {timestamp}
          </Box>
        ) : null}
        {isOwn ? (
          isRead ? (
            <DoneAllIcon sx={{ fontSize: 12, color: '#fff' }} />
          ) : (
            <DoneIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }} />
          )
        ) : null}
      </Box>
    </Box>
  );
};

/** Thumbnail cell for multi-image grid */
export const ChatImageGridCell = ({ attachment, onOpen }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <Box
      component="button"
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onOpen?.();
      }}
      aria-label={attachment?.filename ? `Open image ${attachment.filename}` : 'Open image'}
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        p: 0,
        border: 0,
        cursor: 'pointer',
        borderRadius: '10px',
        overflow: 'hidden',
        bgcolor: 'rgba(0,0,0,0.05)',
        '&:hover': { opacity: 0.92 },
      }}
    >
      <AuthenticatedImage
        attachmentId={attachment.id}
        alt={attachment.filename || 'Image'}
        onLoad={() => setLoaded(true)}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      {!loaded && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ImageOutlinedIcon sx={{ color: chatColors.textSecondary, fontSize: 28 }} />
        </Box>
      )}
    </Box>
  );
};

export default ChatImageAttachment;
