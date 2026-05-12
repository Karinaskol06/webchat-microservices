import React from 'react';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';

export function QuotedKindIcon({ kind }) {
  switch (kind) {
    case 'photo':
    case 'mixed':
      return <ImageIcon sx={{ fontSize: 16, opacity: 0.7, flexShrink: 0 }} />;
    case 'video':
      return <VideoLibraryIcon sx={{ fontSize: 16, opacity: 0.7, flexShrink: 0 }} />;
    case 'file':
    case 'album':
      return <InsertDriveFileIcon sx={{ fontSize: 16, opacity: 0.7, flexShrink: 0 }} />;
    default:
      return null;
  }
}
