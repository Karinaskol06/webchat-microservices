import { describe, expect, it } from 'vitest';
import { parseLinkSegments, trimUrlTrailingPunctuation } from './linkifyMessageText';

describe('trimUrlTrailingPunctuation', () => {
  it('strips trailing punctuation from URLs', () => {
    expect(trimUrlTrailingPunctuation('https://example.com.')).toBe('https://example.com');
    expect(trimUrlTrailingPunctuation('https://example.com)!')).toBe('https://example.com');
  });
});

describe('parseLinkSegments', () => {
  it('returns plain text when no URLs are present', () => {
    expect(parseLinkSegments('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
  });

  it('splits a single URL from surrounding text', () => {
    expect(parseLinkSegments('see https://example.com now')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', value: 'https://example.com', href: 'https://example.com' },
      { type: 'text', value: ' now' },
    ]);
  });

  it('keeps trailing punctuation outside the link', () => {
    expect(parseLinkSegments('go to https://example.com.')).toEqual([
      { type: 'text', value: 'go to ' },
      { type: 'link', value: 'https://example.com', href: 'https://example.com' },
      { type: 'text', value: '.' },
    ]);
  });
});
