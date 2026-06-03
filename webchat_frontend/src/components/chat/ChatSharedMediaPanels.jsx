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

const FileRow = ({ attachment, icon: Icon, onOpen }) => (
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
      '&:hover': { bgcolor: 'rgba(123, 97, 255, 0.08)' },
    }}
  >
    <Icon sx={{ fontSize: 20, color: chatColors.textSecondary, flexShrink: 0 }} />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="body2" noWrap>
        {attachment.filename || 'File'}
      </Typography>
      {attachment.size != null ? (
        <Typography variant="caption" color="text.secondary">
          {formatFileSize(attachment.size)}
        </Typography>
      ) : null}
    </Box>
  </Box>
);

const EmptyHint = ({ children }) => (
  <Typography variant="caption" color="text.secondary">
    {children}
  </Typography>
);

const PhotosPanel = ({ items }) => {
  if (items.length === 0) {
    return <EmptyHint>No photos shared yet.</EmptyHint>;
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
          onClick={() => openAttachment(attachment).catch(() => {})}
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

const VideosPanel = ({ items }) => {
  if (items.length === 0) {
    return <EmptyHint>No videos shared yet.</EmptyHint>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.slice(0, 6).map((attachment) => (
        <FileRow
          key={attachment.id}
          attachment={attachment}
          icon={VideocamOutlinedIcon}
          onOpen={() => openAttachment(attachment).catch(() => {})}
        />
      ))}
    </Box>
  );
};

const FilesPanel = ({ items }) => {
  if (items.length === 0) {
    return <EmptyHint>No files shared yet.</EmptyHint>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {items.slice(0, 12).map((attachment) => (
        <FileRow
          key={attachment.id}
          attachment={attachment}
          icon={InsertDriveFileOutlinedIcon}
          onOpen={() => openAttachment(attachment, { download: true }).catch(() => {})}
        />
      ))}
    </Box>
  );
};

const AudioPanel = ({ items, voice = false }) => {
  if (items.length === 0) {
    return (
      <EmptyHint>{voice ? 'No voice messages yet.' : 'No audio files yet.'}</EmptyHint>
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
        />
      ))}
    </Box>
  );
};

const LinksPanel = ({ items }) => {
  if (items.length === 0) {
    return <EmptyHint>No links shared in messages yet.</EmptyHint>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {items.slice(0, 15).map((item) => (
        <Link
          key={`${item.messageId}-${item.url}`}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{
            fontSize: '0.8rem',
            wordBreak: 'break-all',
            color: chatColors.primary,
          }}
        >
          {item.url}
        </Link>
      ))}
    </Box>
  );
};

const ChatSharedMediaPanels = ({ sectionKey, loading, error, media, links }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="caption" color="text.secondary">
        Shared media is unavailable for this room.
      </Typography>
    );
  }

  switch (sectionKey) {
    case 'photos':
      return <PhotosPanel items={media.photos} />;
    case 'videos':
      return <VideosPanel items={media.videos} />;
    case 'files':
      return <FilesPanel items={media.files} />;
    case 'audio':
      return <AudioPanel items={media.audio} />;
    case 'voice':
      return <AudioPanel items={media.voice} voice />;
    case 'links':
      return <LinksPanel items={links} />;
    default:
      return null;
  }
};

export default ChatSharedMediaPanels;
