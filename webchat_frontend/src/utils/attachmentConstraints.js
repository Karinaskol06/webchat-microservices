/** Keep in sync with chat-service `app.upload` in application.yml */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_MB = 10;

export const ATTACHMENT_MAX_FILES = 10;

export const ATTACHMENT_ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'pdf',
  'txt',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'mp4',
];

const ALLOWED_SET = new Set(ATTACHMENT_ALLOWED_EXTENSIONS);

export const ATTACHMENT_ALLOWED_LABEL = ATTACHMENT_ALLOWED_EXTENSIONS.join(', ');

export const ATTACHMENT_ACCEPT =
  '.jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.doc,.docx,.xls,.xlsx,.mp4,image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,video/mp4';

export function getAttachmentExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return '';
  return trimmed.slice(dot + 1).toLowerCase();
}

/**
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateAttachmentFile(file) {
  if (!file) {
    return { ok: false, message: 'No file was selected.' };
  }

  if (file.size === 0) {
    return {
      ok: false,
      message: `"${file.name}" is empty. Choose another file.`,
    };
  }

  if (file.size > ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      message: `"${file.name}" is too large. Maximum size is ${ATTACHMENT_MAX_MB} MB per file.`,
    };
  }

  const extension = getAttachmentExtension(file.name);
  if (!extension) {
    return {
      ok: false,
      message: `"${file.name}" has no file extension. Allowed types: ${ATTACHMENT_ALLOWED_LABEL}.`,
    };
  }

  if (!ALLOWED_SET.has(extension)) {
    return {
      ok: false,
      message: `"${file.name}" is not allowed (.${extension}). Allowed types: ${ATTACHMENT_ALLOWED_LABEL}.`,
    };
  }

  return { ok: true };
}

/**
 * @param {File[]} files
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateAttachmentFiles(files) {
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) {
    return { ok: false, message: 'No files were selected.' };
  }

  if (list.length > ATTACHMENT_MAX_FILES) {
    return {
      ok: false,
      message: `You can attach up to ${ATTACHMENT_MAX_FILES} files per message.`,
    };
  }

  const failures = list
    .map((file) => ({ file, result: validateAttachmentFile(file) }))
    .filter(({ result }) => !result.ok);

  if (failures.length === 0) {
    return { ok: true };
  }

  if (failures.length === 1) {
    return { ok: false, message: failures[0].result.message };
  }

  return {
    ok: false,
    message: failures.map(({ result }) => result.message).join(' '),
  };
}

/** POST upload: /api/chat/{chatId}/attachments */
export function isChatAttachmentUploadUrl(url = '') {
  const path = String(url).split('?')[0];
  return /\/api\/chat\/[^/]+\/attachments$/i.test(path);
}

/** Upload, list, and download attachment APIs — must not trigger session logout on 401. */
export function isChatAttachmentApiUrl(url = '') {
  const path = String(url).split('?')[0];
  return /\/api\/chat\/(?:[^/]+\/attachments|attachments\/)/i.test(path);
}
