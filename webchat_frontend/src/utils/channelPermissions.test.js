import { describe, expect, it } from 'vitest';
import {
  canModerateOthersMessages,
  canPostInChannel,
  channelPostingRestricted,
  isChannelType,
} from './channelPermissions';

describe('channelPermissions', () => {
  it('isChannelType detects channels', () => {
    expect(isChannelType({ type: 'CHANNEL' })).toBe(true);
    expect(isChannelType({ type: 'GROUP' })).toBe(false);
  });

  it('canPostInChannel allows non-channels and permitted channel members', () => {
    expect(canPostInChannel({ type: 'GROUP' })).toBe(true);
    expect(
      canPostInChannel({
        type: 'CHANNEL',
        isCurrentUserChannelPoster: true,
      }),
    ).toBe(true);
    expect(
      canPostInChannel({
        type: 'CHANNEL',
        isCurrentUserChannelPoster: false,
        isCurrentUserChannelAdmin: false,
        isCurrentUserChannelCreator: false,
      }),
    ).toBe(false);
  });

  it('channelPostingRestricted flags read-only channel members', () => {
    expect(
      channelPostingRestricted({
        type: 'CHANNEL',
        isCurrentUserChannelPoster: false,
        isCurrentUserChannelAdmin: false,
        isCurrentUserChannelCreator: false,
      }),
    ).toBe(true);
  });

  it('canModerateOthersMessages respects group admin and channel moderator', () => {
    expect(canModerateOthersMessages({ type: 'PRIVATE' }, 1)).toBe(false);
    expect(canModerateOthersMessages({ type: 'GROUP', isCurrentUserAdmin: true }, 1)).toBe(
      true,
    );
    expect(
      canModerateOthersMessages(
        { type: 'CHANNEL', isCurrentUserChannelAdmin: true },
        1,
      ),
    ).toBe(true);
    expect(canModerateOthersMessages({ type: 'GROUP', isCurrentUserAdmin: false }, 1)).toBe(
      false,
    );
  });
});
