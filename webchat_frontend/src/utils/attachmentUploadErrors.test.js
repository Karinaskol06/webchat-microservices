import { describe, expect, it } from 'vitest';
import { getAttachmentUploadErrorMessage } from './attachmentUploadErrors';

const makeError = (status, data, headers = {}) => ({
  response: { status, data, headers },
  config: { url: '/api/chat/abc/attachments' },
});

describe('getAttachmentUploadErrorMessage', () => {
  it('maps 413 to a size message', () => {
    const msg = getAttachmentUploadErrorMessage(
      makeError(413, { message: 'too large' }),
    );
    expect(msg).toMatch(/too large/i);
    expect(msg).toMatch(/10\s*MB/i);
  });

  it('uses server message for disallowed file types', () => {
    const serverMsg =
      'This file type is not allowed (.exe). Allowed types: doc, docx, gif, jpg, jpeg, mp4, pdf, png, txt, xls, xlsx.';
    const msg = getAttachmentUploadErrorMessage(
      makeError(400, { message: serverMsg }),
    );
    expect(msg).toBe(serverMsg);
  });

  it('does not treat 401 on uploads as session expiry when body describes validation', () => {
    const msg = getAttachmentUploadErrorMessage(
      makeError(401, { message: 'File is too large. Maximum size is 10 MB.' }),
    );
    expect(msg).toMatch(/too large/i);
    expect(msg).not.toMatch(/session expired/i);
  });
});
