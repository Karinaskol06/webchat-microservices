import { describe, expect, it } from "vitest";
import {
  dateToBirthdayDisplay,
  formatBirthdayDigits,
  parseBirthdayDigits,
  toIsoDate,
  toLocalDate,
} from "./localDate";

describe("localDate", () => {
  it("formats digits with slashes", () => {
    expect(formatBirthdayDigits("15061990")).toBe("15/06/1990");
    expect(formatBirthdayDigits("6")).toBe("6");
    expect(formatBirthdayDigits("1506")).toBe("15/06");
  });

  it("parses valid birthday digits", () => {
    const date = parseBirthdayDigits("15061990");
    expect(date).not.toBeNull();
    expect(date.getFullYear()).toBe(1990);
    expect(date.getMonth()).toBe(5);
    expect(date.getDate()).toBe(15);
  });

  it("rejects invalid dates", () => {
    expect(parseBirthdayDigits("30022000")).toBeNull();
    expect(parseBirthdayDigits("123")).toBeNull();
  });

  it("round-trips ISO dates in local calendar", () => {
    const date = toLocalDate("2000-06-15");
    expect(toIsoDate(date)).toBe("2000-06-15");
    expect(dateToBirthdayDisplay(date)).toBe("15/06/2000");
  });

  it("avoids UTC day shift from ISO strings", () => {
    const date = toLocalDate("1990-01-01");
    expect(date.getDate()).toBe(1);
    expect(date.getMonth()).toBe(0);
  });
});
