/** Detect http(s) URLs in chat message text (shared with shared-media link scan). */

export const MESSAGE_URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

export const trimUrlTrailingPunctuation = (url) =>
  String(url ?? '').replace(/[.,;:!?)]+$/g, '');

/**
 * Split message text into plain text and URL segments.
 * @returns {Array<{ type: 'text' | 'link', value: string, href?: string }>}
 */
export const parseLinkSegments = (text) => {
  const value = String(text ?? '');
  if (!value) return [{ type: 'text', value: '' }];

  const regex = new RegExp(MESSAGE_URL_REGEX.source, MESSAGE_URL_REGEX.flags);
  const segments = [];
  let lastIndex = 0;
  let match = regex.exec(value);

  while (match) {
    const raw = match[0];
    const start = match.index;
    const href = trimUrlTrailingPunctuation(raw);

    if (start > lastIndex) {
      segments.push({ type: 'text', value: value.slice(lastIndex, start) });
    }

    if (href) {
      segments.push({ type: 'link', value: href, href });
      const trailing = raw.slice(href.length);
      if (trailing) {
        segments.push({ type: 'text', value: trailing });
      }
    } else {
      segments.push({ type: 'text', value: raw });
    }

    lastIndex = start + raw.length;
    match = regex.exec(value);
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', value: value.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value }];
};
