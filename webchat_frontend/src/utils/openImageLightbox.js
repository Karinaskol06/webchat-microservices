import useMediaLightboxStore from '../store/useMediaLightboxStore';

export function openImageLightbox(attachment, allImages) {
  if (!attachment?.id) return;

  const items =
    Array.isArray(allImages) && allImages.length > 0 ? allImages : [attachment];
  const initialIndex = Math.max(0, items.findIndex((item) => item.id === attachment.id));

  useMediaLightboxStore.getState().openLightbox({ items, initialIndex });
}
