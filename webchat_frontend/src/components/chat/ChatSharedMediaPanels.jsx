import React from 'react';
import {
  Box,
  CircularProgress,
  Link,
  Typography,
} from '@mui/material';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import AudiotrackOutlinedIcon from '@mui/icons-material/AudiotrackOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import AuthenticatedImage from './AuthenticatedImage';
import { chatColors, chatRadii, muiTransparent } from '../../theme/chatDesignTokens';
import { formatFileSize } from '../../utils/sharedMedia';
import { openAttachment } from '../../utils/openAttachment';
import { openImageLightbox } from '../../utils/openImageLightbox';

const PREVIEW_LIMIT = 9;

const MediaThumbButton = ({ children, label, onClick }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    aria-label={label}
    sx={{
      border: 0,
      p: 0,
      m: 0,
      cursor: 'pointer',
      borderRadius: `${chatRadii.avatar}px`,
      overflow: 'hidden',
      bgcolor: chatColors.surfaceMuted,
      display: 'block',
      width: '100%',
      aspectRatio: '1',
      '&:hover': { opacity: 0.92 },
      '&:focus-visible': {
        outline: `2px solid ${chatColors.primary}`,
        outlineOffset: 2,
      },
    }}
  >
    {children}
  </Box>
);

const FileRow = ({ attachment, icon: Icon, onOpen, glassPanel }) => (
  <Box
    component="button"
    type="button"
    onClick={onOpen}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      width: '100%',
      border: 0,
      bgcolor: muiTransparent,
      cursor: 'pointer',
      textAlign: 'left',
      py: 0.75,
      px: 0.5,
      borderRadius: 1.5,
      color: glassPanel ? chatColors.glassPanelText : 'inherit',
      '&:hover': { bgcolor: 'rgba(16, 8, 26, 0.06)' },
    }}
  >
    <Icon
      sx={{
        fontSize: 20,
        color: glassPanel ? chatColors.glassPanelTextMuted : chatColors.textSecondary,
        flexShrink: 0,
      }}
    />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="body2" noWrap sx={{ color: glassPanel ? chatColors.glassPanelText : 'inherit' }}>
        {attachment.filename || 'File'}
      </Typography>
      {attachment.size != null ? (
        <Typography
          variant="caption"
          sx={{ color: glassPanel ? chatColors.glassPanelTextMuted : 'text.secondary' }}
        >
          {formatFileSize(attachment.size)}
        </Typography>
      ) : null}
    </Box>
  </Box>
);

const EmptyHint = ({ children, glassPanel }) => (
  <Typography
    variant="caption"
    sx={{ color: glassPanel ? chatColors.glassPanelTextMuted : 'text.secondary' }}
  >
    {children}
  </Typography>
);

const PhotosPanel = ({ items, glassPanel }) => {
  if (items.length === 0) {
    return <EmptyHint glassPanel={glassPanel}>No photos shared yet.</EmptyHint>;
  }
  const shown = items.slice(0, PREVIEW_LIMIT);
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 0.75,
      }}
    >
      {shown.map((attachment) => (
        <MediaThumbButton
          key={attachment.id}
          label={`Open ${attachment.filename || 'photo'}`}
          onClick={() => openImageLightbox(attachment, items)}
        >
          <AuthenticatedImage
            attachmentId={attachment.id}
            alt={attachment.filename || 'Photo'}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </MediaThumbButton>
      ))}
    </Box>
  );
};

const VideosPanel = ({ items, glassPanel }) => {
  if (items.length === 0) {
    return <EmptyHint glassPanel={glassPanel}>No videos shared yet.</EmptyHint>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.slice(0, 6).map((attachment) => (
        <FileRow
          key={attachment.id}
          attachment={attachment}
          icon={VideocamOutlinedIcon}
          onOpen={() => openAttachment(attachment).catch(() => {})}
          glassPanel={glassPanel}
        />
      ))}
    </Box>
  );
};

const FilesPanel = ({ items, glassPanel }) => {
  if (items.length === 0) {
    return <EmptyHint glassPanel={glassPanel}>No documents shared yet.</EmptyHint>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {items.slice(0, 12).map((attachment) => (
        <FileRow
          key={attachment.id}
          attachment={attachment}
          icon={InsertDriveFileOutlinedIcon}
          onOpen={() => openAttachment(attachment, { download: true }).catch(() => {})}
          glassPanel={glassPanel}
        />
      ))}
    </Box>
  );
};

const AudioPanel = ({ items, voice = false, glassPanel }) => {
  if (items.length === 0) {
    return (
      <EmptyHint glassPanel={glassPanel}>
        {voice ? 'No voice messages yet.' : 'No audio files yet.'}
      </EmptyHint>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {items.slice(0, 12).map((attachment) => (
        <FileRow
          key={attachment.id}
          attachment={attachment}
          icon={AudiotrackOutlinedIcon}
          onOpen={() => openAttachment(attachment).catch(() => {})}
          glassPanel={glassPanel}
        />
      ))}
    </Box>
  );
};

const LinksPanel = ({ items, glassPanel }) => {
  if (items.length === 0) {
    return <EmptyHint glassPanel={glassPanel}>No links shared in messages yet.</EmptyHint>;
  }
  const linkSx = glassPanel
    ? {
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.45,
        wordBreak: 'break-all',
        color: chatColors.primaryDark,
        textDecorationColor: 'rgba(99, 72, 224, 0.45)',
        '&:hover': {
          color: chatColors.primary,
          textDecorationColor: chatColors.primary,
        },
        '&:visited': {
          color: chatColors.primaryDark,
        },
      }
    : {
        fontSize: '0.8rem',
        wordBreak: 'break-all',
        color: chatColors.primaryLight,
        fontWeight: 600,
      };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {items.slice(0, 15).map((item) => (
        <Link
          key={`${item.messageId}-${item.url}`}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          underline="always"
          sx={linkSx}
        >
          {item.url}
        </Link>
      ))}
    </Box>
  );
};

const ChatSharedMediaPanels = ({ sectionKey, loading, error, media, links, glassPanel = false }) => {
  const hasSectionContent = (() => {
    switch (sectionKey) {
      case 'photos':
        return media.photos.length > 0;
      case 'videos':
        return media.videos.length > 0;
      case 'files':
        return media.files.length > 0;
      case 'audio':
        return media.audio.length > 0;
      case 'voice':
        return media.voice.length > 0;
      case 'links':
        return links.length > 0;
      default:
        return false;
    }
  })();

  if (loading && !hasSectionContent) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography
        variant="caption"
        sx={{ color: glassPanel ? chatColors.glassPanelTextMuted : 'text.secondary' }}
      >
        Shared media is unavailable for this room.
      </Typography>
    );
  }

  switch (sectionKey) {
    case 'photos':
      return <PhotosPanel items={media.photos} glassPanel={glassPanel} />;
    case 'videos':
      return <VideosPanel items={media.videos} glassPanel={glassPanel} />;
    case 'files':
      return <FilesPanel items={media.files} glassPanel={glassPanel} />;
    case 'audio':
      return <AudioPanel items={media.audio} glassPanel={glassPanel} />;
    case 'voice':
      return <AudioPanel items={media.voice} voice glassPanel={glassPanel} />;
    case 'links':
      return <LinksPanel items={links} glassPanel={glassPanel} />;
    default:
      return null;
  }
};

export default ChatSharedMediaPanels;
