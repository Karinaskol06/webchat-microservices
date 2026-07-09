import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {

  acquireAvatarBlob,

  getCachedAvatarBlob,

  releaseAvatarBlob,

  retainAvatarBlob,

} from './avatarBlobCache';



describe('avatarBlobCache', () => {

  beforeEach(() => {

    vi.stubGlobal('URL', {

      revokeObjectURL: vi.fn(),

      createObjectURL: vi.fn((value) => `blob:${value}`),

    });

  });



  afterEach(() => {

    vi.unstubAllGlobals();

  });



  it('reuses the same blob URL with ref counting', () => {

    retainAvatarBlob('/api/users/1/avatar', 1, 'blob:a');

    retainAvatarBlob('/api/users/1/avatar', 1, 'blob:a');

    expect(getCachedAvatarBlob('/api/users/1/avatar', 1)).toBe('blob:a');



    releaseAvatarBlob('/api/users/1/avatar', 1);

    expect(getCachedAvatarBlob('/api/users/1/avatar', 1)).toBe('blob:a');



    releaseAvatarBlob('/api/users/1/avatar', 1);

    expect(getCachedAvatarBlob('/api/users/1/avatar', 1)).toBeNull();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a');

  });



  it('does not revoke an in-use blob when a duplicate URL is retained', () => {

    retainAvatarBlob('/api/users/1/avatar', null, 'blob:a');

    retainAvatarBlob('/api/users/1/avatar', null, 'blob:b');

    expect(getCachedAvatarBlob('/api/users/1/avatar', null)).toBe('blob:a');

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:b');

    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:a');

  });



  it('deduplicates concurrent acquireAvatarBlob calls', async () => {

    const fetchBlob = vi.fn().mockResolvedValue('bytes');

    const [first, second] = await Promise.all([

      acquireAvatarBlob('/api/users/2/avatar', null, fetchBlob),

      acquireAvatarBlob('/api/users/2/avatar', null, fetchBlob),

    ]);

    expect(fetchBlob).toHaveBeenCalledTimes(1);

    expect(first).toBe(second);

    expect(getCachedAvatarBlob('/api/users/2/avatar', null)).toBe('blob:bytes');



    releaseAvatarBlob('/api/users/2/avatar', null);

    expect(getCachedAvatarBlob('/api/users/2/avatar', null)).toBe('blob:bytes');



    releaseAvatarBlob('/api/users/2/avatar', null);

    expect(getCachedAvatarBlob('/api/users/2/avatar', null)).toBeNull();

  });

});

