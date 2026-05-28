import React, { useEffect, useState } from 'react';
import { Avatar } from '@mui/material';
import {
  getUserAvatarLetter,
  resolveUserAvatarSrc,
} from '../../utils/userAvatar';

/**
 * User avatar with image when uploaded, otherwise a letter stub (first name → username).
 */
const UserAvatar = ({
  user,
  src: srcOverride,
  letter: letterOverride,
  alt,
  variant = 'rounded',
  sx,
  ...avatarProps
}) => {
  const resolvedSrc = srcOverride ?? resolveUserAvatarSrc(user);
  const letter = (letterOverride ?? getUserAvatarLetter(user)).toUpperCase();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedSrc]);

  const showImage = Boolean(resolvedSrc) && !imageFailed;

  return (
    <Avatar
      variant={variant}
      alt={alt ?? (user?.username ? `${user.username} avatar` : 'User avatar')}
      src={showImage ? resolvedSrc : undefined}
      imgProps={{
        onError: () => setImageFailed(true),
      }}
      sx={{
        fontWeight: 600,
        fontSize: '0.95rem',
        bgcolor: showImage ? undefined : 'primary.main',
        color: showImage ? undefined : 'primary.contrastText',
        ...sx,
      }}
      {...avatarProps}
    >
      {!showImage ? letter : null}
    </Avatar>
  );
};

export default UserAvatar;
