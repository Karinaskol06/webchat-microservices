import { describe, expect, it } from 'vitest';
import {
  forwardedSourceLabel,
  isForwardedFromRoom,
  isForwardedSourceClickable,
} from './forwardedMessage';

describe('forwardedMessage', () => {
  it('prefers room name for room forwards', () => {
    const message = {
      forwardedFromRoom: { id: 'room-1', name: 'Announcements', type: 'CHANNEL' },
      forwardedFrom: { username: 'Announcements' },
    };
    expect(forwardedSourceLabel(message)).toBe('Announcements');
    expect(isForwardedFromRoom(message)).toBe(true);
    expect(isForwardedSourceClickable(message)).toBe(true);
  });

  it('falls back to user label for user forwards', () => {
    const message = {
      forwardedFrom: { id: 7, username: 'jane' },
    };
    expect(forwardedSourceLabel(message)).toBe('jane');
    expect(isForwardedFromRoom(message)).toBe(false);
    expect(isForwardedSourceClickable(message)).toBe(true);
  });
});
