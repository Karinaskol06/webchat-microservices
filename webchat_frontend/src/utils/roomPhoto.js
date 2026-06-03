import {
  PROFILE_IMAGE_ACCEPT,
  PROFILE_IMAGE_MAX_MB,
  validateProfileImageFile,
} from './profileImageConstraints';

const MAX_EDGE = 512;
const JPEG_QUALITY = 0.82;

function readFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image.'));
    };
    img.src = url;
  });
}

export { PROFILE_IMAGE_ACCEPT as ROOM_PHOTO_ACCEPT };

/** Resize and encode as JPEG data URL for Mongo-friendly room avatars. */
export async function fileToRoomPhotoDataUrl(file) {
  const validation = validateProfileImageFile(file);
  if (!validation.ok) {
    throw new Error(validation.message);
  }
  if (!file.type?.startsWith('image/')) {
    throw new Error(`Please use an image file (PNG, JPEG, or WebP, up to ${PROFILE_IMAGE_MAX_MB} MB).`);
  }
  const img = await readFileAsImage(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Could not read image dimensions.');
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
