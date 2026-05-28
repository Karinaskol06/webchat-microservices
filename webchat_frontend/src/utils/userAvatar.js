/**
 * Initial shown when the user has no custom avatar (e.g. after registration).
 * Prefers the first letter of first name, then username.
 */
export function getUserAvatarLetter(user) {
  if (!user) return '?';

  const fromFirstName = user.firstName?.trim()?.[0];
  if (fromFirstName) {
    return fromFirstName.toUpperCase();
  }

  const fromUsername = user.username?.trim()?.[0];
  if (fromUsername) {
    return fromUsername.toUpperCase();
  }

  return 'U';
}

/** True when the API exposed a profile image URL for this user. */
export function hasUserAvatarImage(user) {
  const url = user?.profilePicture ?? user?.avatar;
  return typeof url === 'string' && url.trim().length > 0;
}

export function resolveUserAvatarSrc(user) {
  if (!hasUserAvatarImage(user)) {
    return undefined;
  }
  const url = user.profilePicture ?? user.avatar;
  return typeof url === 'string' ? url.trim() : undefined;
}
