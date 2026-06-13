import React, { useEffect, useMemo, useState } from 'react';
import { Avatar } from '@mui/material';
import {
  getUserAvatarLetter,
  resolveUserAvatarSrc,
  withMediaCacheKey,
} from '../../utils/userAvatar';
import { useFreshMediaSrc } from '../../hooks/useFreshMediaSrc';
import { muiTransparent } from '../../theme/chatDesignTokens';

/**
 * User avatar with image when uploaded, otherwise a letter stub (first name → username).
 */
const UserAvatar = ({
  user,
  src: srcOverride,
  letter: letterOverride,
  cacheKey,
  /** Skip client-side avatar blob cache (e.g. chat list). */
  disableMediaCache = false,
  alt,
  variant = 'rounded',
  sx,
  ...avatarProps
}) => {
  const rawSrc = useMemo(() => {
    if (srcOverride) {
      return withMediaCacheKey(
        srcOverride,
        cacheKey ?? user?.avatarRevision ?? user?.groupPhotoRevision,
      );
    }
    return resolveUserAvatarSrc(user);
  }, [srcOverride, cacheKey, user]);

  const mediaCacheKey =
    cacheKey ?? user?.avatarRevision ?? user?.groupPhotoRevision ?? null;

  const fetchedSrc = useFreshMediaSrc(rawSrc, mediaCacheKey, disableMediaCache);
  const resolvedSrc = disableMediaCache ? (fetchedSrc ?? rawSrc) : fetchedSrc;
  const letter = (letterOverride ?? getUserAvatarLetter(user)).toUpperCase();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedSrc, mediaCacheKey]);

  const showImage = Boolean(resolvedSrc) && !imageFailed;
  const remountKey = `${resolvedSrc ?? ''}-${mediaCacheKey ?? ''}-${letter}`;

  return (
    <Avatar
      key={remountKey}
      variant={variant}
      alt={alt ?? (user?.username ? `${user.username} avatar` : 'User avatar')}
      src={showImage ? resolvedSrc : undefined}
      imgProps={{
        onError: () => setImageFailed(true),
      }}
      sx={{
        fontWeight: 600,
        fontSize: '0.95rem',
        bgcolor: showImage ? muiTransparent : 'primary.main',
        color: showImage ? 'common.white' : 'primary.contrastText',
        ...sx,
      }}
      {...avatarProps}
    >
      {!showImage ? letter : null}
    </Avatar>
  );
};

export default UserAvatar;
