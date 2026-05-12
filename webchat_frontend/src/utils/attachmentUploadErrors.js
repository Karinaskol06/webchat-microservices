import { getApiErrorMessage } from '../services/api';

const MAX_MB_HINT = 10;

const ALLOWED_TYPES_HINT =
  'Allowed types include images (JPG, PNG, GIF), PDF, Word, Excel, text, and MP4 video.';

/**
 * User-facing copy for chat attachment upload failures (size, type, multipart, access).
 */
export function getAttachmentUploadErrorMessage(error, fallbackMessage = 'Could not upload the file.') {
  const status = error?.response?.status;
  const raw = getApiErrorMessage(error, '').trim();
  const lower = raw.toLowerCase();

  if (status === 403) {
    return "You can't upload files in this chat.";
  }

  if (status === 413 || lower.includes('too large') || lower.includes('maximum size') || lower.includes('exceeds')) {
    return `This file is too large. Maximum size is ${MAX_MB_HINT} MB per file.`;
  }

  if (
    lower.includes('not allowed') &&
    (lower.includes('type') || lower.includes('extension') || lower.includes('file'))
  ) {
    return `This file type isn't allowed. ${ALLOWED_TYPES_HINT}`;
  }

  if (
    lower.includes("doesn't match") ||
    lower.includes('does not match') ||
    lower.includes('wrong extension') ||
    lower.includes('corrupted or renamed')
  ) {
    return "This file doesn't match its type. It may be corrupted or renamed with the wrong extension.";
  }

  if (lower.includes('empty') || lower.includes('null')) {
    return 'The file is empty or could not be read. Choose another file.';
  }

  if (lower.includes('invalid filename') || lower.includes('invalid characters')) {
    return 'This file name is not allowed. Rename the file and try again.';
  }

  if (lower.includes('could not read the uploaded file') || lower.includes('multipart')) {
    return 'The upload could not be processed. Try a smaller file or a supported format.';
  }

  if (raw) {
    return raw;
  }

  if (status === 400) {
    return 'The file could not be uploaded. Check the size and format, then try again.';
  }

  return fallbackMessage;
}
