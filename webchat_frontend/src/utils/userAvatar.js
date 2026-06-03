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

const API_AVATAR_PATH = /^\/api\/users\/\d+\/avatar$/i;

export function isApiUserAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().split('?')[0].split('#')[0];
  return API_AVATAR_PATH.test(trimmed);
}

/** Remove prior cache-bust query/hash so we do not stack v= params. */
export function stripMediaCacheKey(url) {
  if (!url || typeof url !== 'string') return url;
  let u = url.trim();
  if (u.startsWith('data:')) {
    const hash = u.indexOf('#');
    return hash >= 0 ? u.slice(0, hash) : u;
  }
  const [path, query = ''] = u.split('?');
  const params = query
    .split('&')
    .filter((p) => p && p.split('=')[0] !== 'v');
  const nextQuery = params.length ? `?${params.join('&')}` : '';
  return `${path}${nextQuery}`;
}

/** Bust browser cache for stable API image URLs (not data: URLs). */
export function appendCacheBust(url, bust = Date.now()) {
  const base = stripMediaCacheKey(url);
  if (!base || typeof base !== 'string') return base;
  const trimmed = base.trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed;
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}v=${bust}`;
}

/** Apply revision to API URLs (?v=) and data: URLs (#rev=) so <img> reloads. */
export function withMediaCacheKey(url, cacheKey) {
  if (!url || cacheKey == null) return url;
  const trimmed = stripMediaCacheKey(url).trim();
  if (!trimmed) return url;
  if (trimmed.startsWith('data:')) {
    return `${trimmed}#rev=${cacheKey}`;
  }
  return appendCacheBust(trimmed, cacheKey);
}

export function resolveUserAvatarSrc(user) {
  if (!hasUserAvatarImage(user)) {
    return undefined;
  }
  const url = user.profilePicture ?? user.avatar;
  const trimmed = typeof url === 'string' ? url.trim() : undefined;
  if (!trimmed) return undefined;
  return withMediaCacheKey(trimmed, user?.avatarRevision);
}

/** Bust cache for room avatars (HTTP paths only; data: URLs use groupPhotoRevision + #rev=). */
export function bustRoomPhotoUrl(url, revision = Date.now()) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (!trimmed) return url;
  return withMediaCacheKey(trimmed, revision);
}

export function resolveRoomAvatarSrc(chat) {
  if (!chat?.groupPhoto) return undefined;
  return withMediaCacheKey(chat.groupPhoto, chat.groupPhotoRevision);
}
