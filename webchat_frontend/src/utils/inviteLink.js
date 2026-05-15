import { getApiErrorMessage } from '../services/api';

/** Accept full app URL (/join/TOKEN), other URLs with ?token=, or raw token. */
export function parseInviteToken(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const slashJoin = s.match(/\/join\/([^/?#\s]+)/i);
  if (slashJoin?.[1]) {
    try {
      return decodeURIComponent(slashJoin[1]);
    } catch {
      return slashJoin[1];
    }
  }
  try {
    const u = new URL(s);
    const pathMatch = u.pathname.match(/\/join\/([^/]+)/i);
    if (pathMatch?.[1]) {
      try {
        return decodeURIComponent(pathMatch[1]);
      } catch {
        return pathMatch[1];
      }
    }
    const q = u.searchParams.get('token') || u.searchParams.get('invite');
    if (q?.trim()) return q.trim();
  } catch {
    // not an absolute URL
  }
  return s;
}

export function joinInviteErrorMessage(err) {
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err.message === 'string' && err.message.trim()) return err.message;
  return getApiErrorMessage(err, 'Could not join with this invite.');
}
