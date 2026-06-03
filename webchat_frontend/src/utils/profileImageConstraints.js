/** Keep in sync with user-service ProfileImageUploadValidator */

export const PROFILE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PROFILE_IMAGE_MAX_MB = 10;

export const PROFILE_IMAGE_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export const PROFILE_IMAGE_ALLOWED_LABEL = PROFILE_IMAGE_ALLOWED_EXTENSIONS.join(', ');

export const PROFILE_IMAGE_ACCEPT =
  'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

function extensionFromName(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return '';
  return trimmed.slice(dot + 1).toLowerCase();
}

/**
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateProfileImageFile(file) {
  if (!file) {
    return { ok: false, message: 'No image was selected.' };
  }

  if (file.size === 0) {
    return {
      ok: false,
      message: `"${file.name}" is empty. Choose another image.`,
    };
  }

  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      message: `"${file.name}" is too large. Maximum size is ${PROFILE_IMAGE_MAX_MB} MB.`,
    };
  }

  const extension = extensionFromName(file.name);
  if (!extension) {
    return {
      ok: false,
      message: `"${file.name}" has no file extension. Allowed types: ${PROFILE_IMAGE_ALLOWED_LABEL}.`,
    };
  }

  if (!PROFILE_IMAGE_ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      ok: false,
      message: `"${file.name}" is not allowed (.${extension}). Use PNG, JPEG, or WebP.`,
    };
  }

  const type = String(file.type || '').toLowerCase();
  if (
    type &&
    !type.startsWith('image/') &&
    type !== 'application/octet-stream'
  ) {
    return {
      ok: false,
      message: `"${file.name}" is not an image. Allowed types: ${PROFILE_IMAGE_ALLOWED_LABEL}.`,
    };
  }

  return { ok: true };
}

export function isProfileImageUploadUrl(url = '') {
  const path = String(url).split('?')[0];
  return /\/api\/users\/profile\/(?:avatar|background)$/i.test(path);
}
