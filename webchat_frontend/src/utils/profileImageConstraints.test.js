import { describe, expect, it } from 'vitest';
import {
  PROFILE_IMAGE_MAX_BYTES,
  validateProfileImageFile,
} from './profileImageConstraints';

describe('validateProfileImageFile', () => {
  it('rejects files over the size limit', () => {
    const file = new File([new ArrayBuffer(PROFILE_IMAGE_MAX_BYTES + 1)], 'big.jpg', {
      type: 'image/jpeg',
    });
    const result = validateProfileImageFile(file);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/too large/i);
  });

  it('rejects disallowed extensions', () => {
    const file = new File(['x'], 'photo.gif', { type: 'image/gif' });
    expect(validateProfileImageFile(file).ok).toBe(false);
  });

  it('accepts allowed extensions', () => {
    const file = new File(['x'], 'photo.webp', { type: 'image/webp' });
    expect(validateProfileImageFile(file).ok).toBe(true);
  });
});
