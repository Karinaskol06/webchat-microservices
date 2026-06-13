export const USER_BANNED_CODE = 'USER_BANNED';

export function parseUserBanError(error) {
  const body = error?.response?.data;
  if (!body || body.code !== USER_BANNED_CODE) {
    return null;
  }
  return {
    banned: true,
    message: body.message || body.error || 'This private chat is unavailable.',
    displayName: body.displayName,
  };
}
