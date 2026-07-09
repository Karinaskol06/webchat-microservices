/** Shared blob URL cache for authenticated avatars — avoids revoke storms in Edge. */

const cache = new Map();
const inflight = new Map();

const entryKey = (path, revision) => `${path}|${revision ?? ''}`;

export function retainAvatarBlob(path, revision, blobUrl) {
  const key = entryKey(path, revision);
  const existing = cache.get(key);
  if (existing) {
    if (existing.url !== blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    existing.refCount += 1;
    return existing.url;
  }
  cache.set(key, { url: blobUrl, refCount: 1 });
  return blobUrl;
}

export function releaseAvatarBlob(path, revision) {
  const key = entryKey(path, revision);
  const entry = cache.get(key);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    URL.revokeObjectURL(entry.url);
    cache.delete(key);
  }
}

export function getCachedAvatarBlob(path, revision) {
  const entry = cache.get(entryKey(path, revision));
  return entry?.url ?? null;
}

/**
 * Returns a shared blob URL for the avatar path, deduplicating concurrent fetches.
 * Each successful call must be paired with {@link releaseAvatarBlob} on unmount.
 */
export async function acquireAvatarBlob(path, revision, fetchBlob) {
  const key = entryKey(path, revision);
  const existing = cache.get(key);
  if (existing) {
    existing.refCount += 1;
    return existing.url;
  }

  let promise = inflight.get(key);
  if (!promise) {
    promise = (async () => {
      const blob = await fetchBlob();
      const cached = cache.get(key);
      if (cached) {
        return cached.url;
      }
      const blobUrl = URL.createObjectURL(blob);
      cache.set(key, { url: blobUrl, refCount: 0 });
      return blobUrl;
    })().finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, promise);
  }

  const url = await promise;
  const entry = cache.get(key);
  if (entry) {
    entry.refCount += 1;
  }
  return url;
}
