import { describe, expect, it } from 'vitest';
import {
  getUserAvatarLetter,
  hasUserAvatarImage,
  resolveUserAvatarSrc,
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
});

describe('hasUserAvatarImage', () => {
  it('detects avatar on profilePicture or avatar field', () => {
    expect(hasUserAvatarImage({ avatar: '/api/users/2/avatar' })).toBe(true);
    expect(hasUserAvatarImage({ profilePicture: '' })).toBe(false);
  });
});
