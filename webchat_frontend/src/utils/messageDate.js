/** Local-calendar helpers for chat message day grouping. */

export function parseMessageTimestamp(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (Array.isArray(value) && value.length >= 3) {
    const [y, mo = 1, day = 1, h = 0, mi = 0, s = 0] = value;
    const date = new Date(y, mo - 1, day, h, mi, s);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function messageDayKey(value) {
  const date = parseMessageTimestamp(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMessageDayLabel(value, t, now = new Date()) {
  const date = parseMessageTimestamp(value);
  if (!date) return '';

  const key = messageDayKey(date);
  const todayKey = messageDayKey(now);
  if (key === todayKey) {
    return t('message.date.today');
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === messageDayKey(yesterday)) {
    return t('message.date.yesterday');
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function shouldShowDaySeparator(messages, index) {
  if (!Array.isArray(messages) || index < 0 || index >= messages.length) return false;
  const dayKey = messageDayKey(messages[index]?.timestamp);
  if (!dayKey) return false;
  if (index === 0) return true;
  return dayKey !== messageDayKey(messages[index - 1]?.timestamp);
}
