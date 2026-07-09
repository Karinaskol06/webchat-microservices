import { useEffect, useState } from 'react';
import api from '../services/api';
import { isApiUserAvatarUrl } from '../utils/userAvatar';
import {
  acquireAvatarBlob,
  releaseAvatarBlob,
} from '../utils/avatarBlobCache';

/**
 * Loads authenticated API avatar URLs as blob URLs.
 * When disableCache is true (chat list), skips the in-memory blob cache.
 */
export function useFreshMediaSrc(src, cacheKey, disableCache = false) {
  const [resolved, setResolved] = useState(() => {
    if (!src || disableCache || !isApiUserAvatarUrl(src)) return src;
    return undefined;
  });

  useEffect(() => {
    if (!src) {
      setResolved(undefined);
      return undefined;
    }

    if (disableCache || !isApiUserAvatarUrl(src)) {
      setResolved(src);
      return undefined;
    }

    const path = src.trim().split('?')[0].split('#')[0];
    let cancelled = false;
    let acquired = false;

    const run = async () => {
      try {
        const url = await acquireAvatarBlob(path, cacheKey, async () => {
          const response = await api.get(path, { responseType: 'blob' });
          return response.data;
        });
        if (cancelled) {
          releaseAvatarBlob(path, cacheKey);
          return;
        }
        acquired = true;
        setResolved(url);
      } catch {
        if (!cancelled) {
          setResolved(undefined);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (acquired) {
        releaseAvatarBlob(path, cacheKey);
      }
    };
  }, [src, cacheKey, disableCache]);

  if (disableCache) {
    return src;
  }

  if (!isApiUserAvatarUrl(src)) {
    return resolved ?? src;
  }

  return resolved;
}
