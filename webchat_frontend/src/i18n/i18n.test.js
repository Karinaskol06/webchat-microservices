import { describe, expect, it } from 'vitest';
import { translate } from '../i18n';

describe('translate', () => {
  it('returns English by default', () => {
    expect(translate('en', 'settings.title')).toBe('Settings');
  });

  it('returns Ukrainian when locale is uk', () => {
    expect(translate('uk', 'settings.title')).toBe('Налаштування');
  });

  it('interpolates params', () => {
    expect(translate('en', 'common.members', { count: 5 })).toBe('5 members');
    expect(translate('uk', 'common.members', { count: 5 })).toBe('5 учасників');
  });

  it('falls back to English for missing keys', () => {
    expect(translate('uk', 'nonexistent.key')).toBe('nonexistent.key');
  });
});
