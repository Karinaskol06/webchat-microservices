import { describe, expect, it } from 'vitest';
import {
  formatMessageDayLabel,
  messageDayKey,
  parseMessageTimestamp,
  shouldShowDaySeparator,
} from './messageDate';

const t = (key) => {
  const map = {
    'message.date.today': 'Today',
    'message.date.yesterday': 'Yesterday',
  };
  return map[key] ?? key;
};

describe('messageDate', () => {
  it('parses ISO timestamps in local calendar', () => {
    const date = parseMessageTimestamp('2026-06-22T14:30:00.000Z');
    expect(date).not.toBeNull();
    expect(messageDayKey(date)).toBeTruthy();
  });

  it('formats today and yesterday labels', () => {
    const now = new Date(2026, 5, 22, 12, 0, 0);
    expect(formatMessageDayLabel(now, t, now)).toBe('Today');

    const yesterday = new Date(2026, 5, 21, 9, 0, 0);
    expect(formatMessageDayLabel(yesterday, t, now)).toBe('Yesterday');
  });

  it('detects day boundaries between messages', () => {
    const messages = [
      { timestamp: '2026-06-21T22:00:00.000Z' },
      { timestamp: '2026-06-22T08:00:00.000Z' },
    ];
    expect(shouldShowDaySeparator(messages, 0)).toBe(true);
    expect(shouldShowDaySeparator(messages, 1)).toBe(
      messageDayKey(messages[0].timestamp) !== messageDayKey(messages[1].timestamp),
    );
  });
});
