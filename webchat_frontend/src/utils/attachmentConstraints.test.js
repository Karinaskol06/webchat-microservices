import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_MAX_BYTES,
  validateAttachmentFile,
  validateAttachmentFiles,
} from './attachmentConstraints';

describe('validateAttachmentFile', () => {
  it('rejects files over the size limit', () => {
    const file = new File([new ArrayBuffer(ATTACHMENT_MAX_BYTES + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    const result = validateAttachmentFile(file);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/too large/i);
  });

  it('rejects disallowed extensions', () => {
    const file = new File(['x'], 'malware.exe', { type: 'application/octet-stream' });
    const result = validateAttachmentFile(file);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not allowed/i);
    expect(result.message).toMatch(/exe/i);
  });

  it('rejects files without an extension', () => {
    const file = new File(['x'], 'readme', { type: 'text/plain' });
    const result = validateAttachmentFile(file);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no file extension/i);
  });

  it('accepts allowed extensions', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    expect(validateAttachmentFile(file).ok).toBe(true);
  });
});

describe('validateAttachmentFiles', () => {
  it('aggregates multiple validation failures', () => {
    const files = [
      new File(['x'], 'bad.exe', { type: 'application/octet-stream' }),
      new File([new ArrayBuffer(ATTACHMENT_MAX_BYTES + 1)], 'big.pdf', {
        type: 'application/pdf',
      }),
    ];
    const result = validateAttachmentFiles(files);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not allowed/i);
    expect(result.message).toMatch(/too large/i);
  });
});
