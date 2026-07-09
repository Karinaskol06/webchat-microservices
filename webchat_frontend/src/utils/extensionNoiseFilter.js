const EXTENSION_ASYNC_NOISE =
  /message channel closed before a response was received/i;

/**
 * Edge/Chrome extensions (password managers, Copilot helpers, etc.) inject scripts
 * that use chrome.runtime messaging and can reject promises on host pages.
 * This is not app code — filter it so it does not pollute the console.
 */
export function installExtensionNoiseFilter() {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      (reason && typeof reason === 'object' && typeof reason.message === 'string'
        ? reason.message
        : String(reason ?? ''));
    if (EXTENSION_ASYNC_NOISE.test(message)) {
      event.preventDefault();
    }
  });
}
