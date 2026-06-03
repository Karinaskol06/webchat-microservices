import { describe, expect, it } from 'vitest';
import {
  appendCacheBust,
  getUserAvatarLetter,
  hasUserAvatarImage,
  resolveRoomAvatarSrc,
  resolveUserAvatarSrc,
  stripMediaCacheKey,
  withMediaCacheKey,
} from './userAvatar';

describe('getUserAvatarLetter', () => {
  it('uses the first letter of first name', () => {
    expect(getUserAvatarLetter({ firstName: 'Anna', username: 'anna99' })).toBe('A');
  });

  it('falls back to username when first name is missing', () => {
    expect(getUserAvatarLetter({ username: 'bob' })).toBe('B');
  });

  it('returns U when no name fields exist', () => {
    expect(getUserAvatarLetter({})).toBe('U');
  });
});

describe('appendCacheBust', () => {
  it('appends a version query param to API avatar URLs', () => {
    expect(appendCacheBust('/api/users/1/avatar', 99)).toBe('/api/users/1/avatar?v=99');
  });

  it('leaves data URLs unchanged', () => {
    const data = 'data:image/jpeg;base64,abc';
    expect(appendCacheBust(data, 99)).toBe(data);
  });

  it('replaces an existing v= param instead of stacking', () => {
    expect(appendCacheBust('/api/users/1/avatar?v=1', 2)).toBe('/api/users/1/avatar?v=2');
  });
});

describe('withMediaCacheKey', () => {
  it('adds #rev= to data URLs', () => {
    const data = 'data:image/jpeg;base64,abc';
    expect(withMediaCacheKey(data, 5)).toBe(`${data}#rev=5`);
  });
});

describe('resolveUserAvatarSrc', () => {
  it('returns undefined when user has no avatar URL', () => {
    expect(resolveUserAvatarSrc({ firstName: 'Ann' })).toBeUndefined();
    expect(resolveUserAvatarSrc({ profilePicture: null })).toBeUndefined();
  });

  it('returns the profile picture URL when set', () => {
    expect(
      resolveUserAvatarSrc({ profilePicture: '/api/users/1/avatar' }),
    ).toBe('/api/users/1/avatar');
  });

  it('applies avatarRevision to API URLs', () => {
    expect(
      resolveUserAvatarSrc({
        profilePicture: '/api/users/1/avatar',
        avatarRevision: 42,
      }),
    ).toBe('/api/users/1/avatar?v=42');
  });
});

describe('resolveRoomAvatarSrc', () => {
  it('applies groupPhotoRevision to room photos', () => {
    expect(
      resolveRoomAvatarSrc({
        groupPhoto: 'data:image/jpeg;base64,abc',
        groupPhotoRevision: 9,
      }),
    ).toBe('data:image/jpeg;base64,abc#rev=9');
  });
});

describe('stripMediaCacheKey', () => {
  it('strips query and hash cache keys', () => {
    expect(stripMediaCacheKey('/api/users/1/avatar?v=1')).toBe('/api/users/1/avatar');
    expect(stripMediaCacheKey('data:image/png;base64,x#rev=1')).toBe('data:image/png;base64,x');
  });
});

describe('hasUserAvatarImage', () => {
  it('detects avatar on profilePicture or avatar field', () => {
    expect(hasUserAvatarImage({ avatar: '/api/users/2/avatar' })).toBe(true);
    expect(hasUserAvatarImage({ profilePicture: '' })).toBe(false);
  });
});
