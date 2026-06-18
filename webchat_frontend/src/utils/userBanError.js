export const USER_BANNED_CODE = 'USER_BANNED';

const PRIVATE_CHAT_BLOCKED_MESSAGE = 'You are not a member of this chat';

function readErrorBody(error) {
  if (error?.response?.data) {
    return error.response.data;
  }
  if (error?.data && typeof error.data === 'object') {
    return error.data;
  }
  if (error && typeof error === 'object' && (error.code || error.error)) {
    return error;
  }
  return null;
}

function readErrorStatus(error) {
  return error?.response?.status ?? error?.status ?? null;
}

function readErrorMessage(body, error) {
  const fromBody = (() => {
    if (!body) return '';
    if (typeof body === 'string') return body.trim();
    return String(body.message || body.error || '').trim();
  })();
  if (fromBody) return fromBody;
  return typeof error?.message === 'string' ? error.message.trim() : '';
}

export function parseUserBanError(error) {
  const body = readErrorBody(error);
  if (!body || body.code !== USER_BANNED_CODE) {
    return null;
  }
  return {
    banned: true,
    message: body.message || body.error || 'This private chat is unavailable.',
    displayName: body.displayName,
  };
}

/** Banned by the other user when starting or sending in a private chat (generic 403 from backend). */
export function parsePrivateMessageBlockedError(error, { isNewPrivateChat = false } = {}) {
  const userBan = parseUserBanError(error);
  if (userBan) {
    return { blocked: true, silent: true, message: userBan.message };
  }

  if (!isNewPrivateChat) {
    return null;
  }

  const body = readErrorBody(error);
  const status = readErrorStatus(error);
  const message = readErrorMessage(body, error);
  if (message !== PRIVATE_CHAT_BLOCKED_MESSAGE) {
    return null;
  }
  if (status != null && status !== 403) {
    return null;
  }

  return { blocked: true, silent: true };
}
