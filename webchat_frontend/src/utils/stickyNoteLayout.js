/** Layout helpers for personal-space floating sticky notes (content-relative coords). */

export const STICKY_NOTE_SIZE = { width: 200, height: 160 };

export function getStickyContentBounds(viewport, contentEl) {
  const pad = 16;
  const width = Math.max(
    contentEl?.scrollWidth ?? 0,
    viewport?.clientWidth ?? 0,
    STICKY_NOTE_SIZE.width + pad * 2,
  );
  const height = Math.max(
    contentEl?.scrollHeight ?? 0,
    viewport?.clientHeight ?? 0,
    STICKY_NOTE_SIZE.height + pad * 2,
  );
  return { width, height };
}

/** Clamp within the scrollable content area (not the visible viewport slice). */
export function clampStickyToContent(x, y, bounds, size = STICKY_NOTE_SIZE) {
  const pad = 16;
  const maxX = Math.max(pad, bounds.width - size.width - pad);
  const maxY = Math.max(pad, bounds.height - size.height - pad);
  return {
    x: Math.min(maxX, Math.max(pad, x)),
    y: Math.min(maxY, Math.max(pad, y)),
  };
}

/** Random position within the currently visible message viewport. */
export function stickyPlacementInViewport(viewport, size = STICKY_NOTE_SIZE) {
  if (!viewport) return { x: 40, y: 40 };
  const pad = 24;
  const scrollTop = viewport.scrollTop;
  const scrollLeft = viewport.scrollLeft;
  const availW = Math.max(1, viewport.clientWidth - size.width - pad * 2);
  const availH = Math.max(1, viewport.clientHeight - size.height - pad * 2);
  return {
    x: scrollLeft + pad + Math.floor(Math.random() * availW),
    y: scrollTop + pad + Math.floor(Math.random() * availH),
  };
}

/** @deprecated use clampStickyToContent */
export function clampStickyPosition(x, y, viewport, size = STICKY_NOTE_SIZE) {
  const bounds = getStickyContentBounds(viewport, viewport?.firstElementChild);
  return clampStickyToContent(x, y, bounds, size);
}
