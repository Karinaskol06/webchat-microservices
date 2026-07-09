import { describe, expect, it } from 'vitest';
import {
  clampFontScale,
  FONT_SCALE_DEFAULT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
} from './applyFontScale';

describe('applyFontScale', () => {
  it('clamps values to the supported range', () => {
    expect(clampFontScale(0.5)).toBe(FONT_SCALE_MIN);
    expect(clampFontScale(2)).toBe(FONT_SCALE_MAX);
    expect(clampFontScale(1)).toBe(FONT_SCALE_DEFAULT);
    expect(clampFontScale('bad')).toBe(FONT_SCALE_DEFAULT);
  });
});
