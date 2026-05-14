/** Matches backend InternationalPhoneValidator: + then 7–15 digits, first digit 1–9. */
export const PHONE_FORMAT_HINT = "+ then country & number (7–15 digits total, e.g. +48123456789)";

export function isValidInternationalPhone(value) {
  if (value == null || String(value).trim() === "") return true;
  const phone = String(value).trim();
  if (!phone.startsWith("+") || phone.length < 2) return false;
  const rest = phone.slice(1);
  if (rest.length < 7 || rest.length > 15) return false;
  if (!/^\d+$/.test(rest)) return false;
  const first = rest[0];
  return first >= "1" && first <= "9";
}

export function splitPhoneToDialNational(full, options, preferredIso) {
  const s = (full || "").trim();
  const pref = options.find((o) => o.iso === (preferredIso || "").toUpperCase());
  const ua = options.find((o) => o.iso === "UA");
  if (!s) {
    return { iso: pref?.iso || ua?.iso || "UA", dial: pref?.dial || ua?.dial || "+380", national: "" };
  }
  if (!s.startsWith("+")) {
    return { iso: pref?.iso || ua?.iso || "UA", dial: pref?.dial || ua?.dial || "+380", national: s.replace(/\D/g, "") };
  }
  for (const o of options) {
    if (s.startsWith(o.dial)) {
      return { iso: o.iso, dial: o.dial, national: s.slice(o.dial.length).replace(/\D/g, "") };
    }
  }
  const def = pref || ua || options[0];
  return { iso: def.iso, dial: def.dial, national: s.slice(1).replace(/\D/g, "") };
}

export function combinePhone(dial, nationalDigits) {
  const n = String(nationalDigits || "").replace(/\D/g, "");
  if (!n) return "";
  return `${dial}${n}`;
}
