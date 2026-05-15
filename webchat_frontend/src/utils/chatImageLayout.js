/**
 * Fit a chat image inside the message viewport (not the bubble).
 * Landscape: ≤ 50% chat width and height.
 * Portrait: ≤ 50% chat width and 80% (4/5) chat height.
 */
export function computeChatImageDisplaySize(naturalWidth, naturalHeight, chatAreaWidth, chatAreaHeight) {
  const nw = Number(naturalWidth);
  const nh = Number(naturalHeight);
  const cw = Number(chatAreaWidth);
  const ch = Number(chatAreaHeight);

  if (!(nw > 0 && nh > 0 && cw > 0 && ch > 0)) {
    return null;
  }

  const isLandscape = nw >= nh;
  const maxWidth = cw * 0.5;
  const maxHeight = ch * (isLandscape ? 0.5 : 0.8);
  const scale = Math.min(maxWidth / nw, maxHeight / nh, 1);

  return {
    width: Math.max(1, Math.round(nw * scale)),
    height: Math.max(1, Math.round(nh * scale)),
    isLandscape,
  };
}
