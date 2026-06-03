import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { isApiUserAvatarUrl } from '../utils/userAvatar';

/**
 * Loads authenticated API avatar URLs as blob URLs.
 * When disableCache is true (chat list), skips the in-memory blob cache.
 */
export function useFreshMediaSrc(src, cacheKey, disableCache = false) {
  const [resolved, setResolved] = useState(src);
  const activeBlobRef = useRef(null);

  useEffect(() => {
    const revokeActiveBlob = () => {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
    };

    if (!src) {
      revokeActiveBlob();
      setResolved(undefined);
      return undefined;
    }

    if (disableCache || !isApiUserAvatarUrl(src)) {
      revokeActiveBlob();
      setResolved(src);
      return undefined;
    }

    let cancelled = false;
    revokeActiveBlob();
    setResolved(undefined);

    const run = async () => {
      try {
        const path = src.trim().split('?')[0].split('#')[0];
        const response = await api.get(path, { responseType: 'blob' });
        const blobUrl = URL.createObjectURL(response.data);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        activeBlobRef.current = blobUrl;
        setResolved(blobUrl);
      } catch {
        if (!cancelled) {
          setResolved(src);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      revokeActiveBlob();
      setResolved(undefined);
    };
  }, [src, cacheKey, disableCache]);

  if (disableCache) {
    return src;
  }

  return resolved ?? src;
}
