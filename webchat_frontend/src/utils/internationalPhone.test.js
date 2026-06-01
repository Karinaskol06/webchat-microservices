import { describe, expect, it } from 'vitest';
import {
  combinePhone,
  isValidInternationalPhone,
  splitPhoneToDialNational,
} from './internationalPhone';

const OPTIONS = [
  { iso: 'UA', dial: '+380' },
  { iso: 'PL', dial: '+48' },
  { iso: 'US', dial: '+1' },
];

describe('isValidInternationalPhone', () => {
  it('allows empty optional phone', () => {
    expect(isValidInternationalPhone('')).toBe(true);
    expect(isValidInternationalPhone(null)).toBe(true);
  });

  it('accepts valid E.164 numbers', () => {
    expect(isValidInternationalPhone('+48123456789')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidInternationalPhone('48123456789')).toBe(false);
    expect(isValidInternationalPhone('+0123456789')).toBe(false);
    expect(isValidInternationalPhone('+48abc')).toBe(false);
  });
});

describe('splitPhoneToDialNational', () => {
  it('splits known dial code', () => {
    expect(splitPhoneToDialNational('+48111222333', OPTIONS)).toEqual({
      iso: 'PL',
      dial: '+48',
      national: '111222333',
    });
  });
});

describe('combinePhone', () => {
  it('joins dial and national digits', () => {
    expect(combinePhone('+48', '123456789')).toBe('+48123456789');
    expect(combinePhone('+48', '')).toBe('');
  });
});
