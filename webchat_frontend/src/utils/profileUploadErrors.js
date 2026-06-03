import { getApiErrorMessage } from '../services/api';
import { PROFILE_IMAGE_ALLOWED_LABEL, PROFILE_IMAGE_MAX_MB } from './profileImageConstraints';

/**
 * User-facing copy for avatar / cover photo upload failures.
 */
export function getProfileImageUploadErrorMessage(
  error,
  fallbackMessage = 'Could not upload image.',
) {
  const status = error?.response?.status;
  const raw = getApiErrorMessage(error, '').trim();
  const lower = raw.toLowerCase();

  if (status === 413 || lower.includes('too large') || lower.includes('maximum size')) {
    if (raw && /mb/i.test(raw)) {
      return raw;
    }
    return `Image is too large. Maximum size is ${PROFILE_IMAGE_MAX_MB} MB.`;
  }

  if (
    lower.includes('not allowed') ||
    lower.includes('allowed types') ||
    lower.includes('no file extension') ||
    lower.includes("doesn't look") ||
    lower.includes("doesn't match") ||
    lower.includes('does not match') ||
    lower.includes('only png')
  ) {
    return raw || `Use PNG, JPEG, or WebP (${PROFILE_IMAGE_ALLOWED_LABEL}).`;
  }

  if (lower.includes('empty') || lower.includes('corrupted') || lower.includes('required')) {
    return raw || 'The image file is empty or could not be read.';
  }

  if (lower.includes('multipart') || lower.includes('could not read')) {
    return raw || 'The upload could not be processed. Try a smaller PNG, JPEG, or WebP file.';
  }

  if (raw) {
    return raw;
  }

  if (status === 401) {
    return 'Your session expired. Sign in again, then retry the upload.';
  }

  return fallbackMessage;
}
