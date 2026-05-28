import { getApiErrorMessage } from '../services/api';
import { ATTACHMENT_ALLOWED_LABEL, ATTACHMENT_MAX_MB } from './attachmentConstraints';

const looksLikeFileValidationMessage = (text = '') => {
  const lower = text.toLowerCase();
  return (
    lower.includes('too large') ||
    lower.includes('maximum size') ||
    lower.includes('not allowed') ||
    lower.includes('allowed types') ||
    lower.includes('no file extension') ||
    lower.includes('empty') ||
    lower.includes("doesn't match") ||
    lower.includes('does not match') ||
    lower.includes('multipart') ||
    lower.includes('could not read the uploaded file') ||
    lower.includes('invalid filename') ||
    lower.includes('invalid characters') ||
    lower.includes('payload too large') ||
    lower.includes('exceeds')
  );
};

/**
 * User-facing copy for chat attachment upload failures (size, type, multipart, access).
 */
export function getAttachmentUploadErrorMessage(
  error,
  fallbackMessage = 'Could not upload the file.',
) {
  const status = error?.response?.status;
  const raw = getApiErrorMessage(error, '').trim();
  const lower = raw.toLowerCase();

  if (status === 413 || lower.includes('too large') || lower.includes('maximum size') || lower.includes('exceeds')) {
    if (raw && /mb/i.test(raw)) {
      return raw;
    }
    return `This file is too large. Maximum size is ${ATTACHMENT_MAX_MB} MB per file.`;
  }

  if (
    lower.includes('not allowed') ||
    (lower.includes('allowed types') && lower.includes('file type'))
  ) {
    return raw || `This file type isn't allowed. Allowed types: ${ATTACHMENT_ALLOWED_LABEL}.`;
  }

  if (
    lower.includes('no file extension') ||
    (lower.includes('extension') && lower.includes('allowed'))
  ) {
    return raw || `This file has no extension. Allowed types: ${ATTACHMENT_ALLOWED_LABEL}.`;
  }

  if (
    lower.includes("doesn't match") ||
    lower.includes('does not match') ||
    lower.includes('wrong extension') ||
    lower.includes('corrupted or renamed')
  ) {
    return (
      raw ||
      "This file doesn't match its type. It may be corrupted or renamed with the wrong extension."
    );
  }

  if (lower.includes('empty') || lower.includes('null')) {
    return raw || 'The file is empty or could not be read. Choose another file.';
  }

  if (lower.includes('invalid filename') || lower.includes('invalid characters')) {
    return raw || 'This file name is not allowed. Rename the file and try again.';
  }

  if (lower.includes('could not read the uploaded file') || lower.includes('multipart')) {
    return (
      raw ||
      'The upload could not be processed. Try a smaller file or a supported format.'
    );
  }

  if (status === 403) {
    return raw || "You can't upload files in this chat.";
  }

  if (raw) {
    return raw;
  }

  if (status === 401) {
    if (looksLikeFileValidationMessage(raw)) {
      return raw;
    }
    return 'Your session expired. Sign in again, then retry the upload.';
  }

  if (status === 400) {
    return 'The file could not be uploaded. Check the size and format, then try again.';
  }

  if (status === 502 || status === 503 || status === 504) {
    return 'Upload service is temporarily unavailable. Try again in a moment.';
  }

  return fallbackMessage;
}
