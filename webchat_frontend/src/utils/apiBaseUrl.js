/** Dev / Docker nginx: same-origin (/api, /ws). Override with VITE_API_BASE_URL for split hosting. */
export function resolveApiBaseUrl() {
  if (import.meta.env.DEV) {
    return '';
  }
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured === '' || configured === 'SAME_ORIGIN') {
    return '';
  }
  return (configured || 'http://localhost:8089').replace(/\/$/, '');
}
