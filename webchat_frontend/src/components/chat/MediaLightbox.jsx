import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import AuthenticatedImage from './AuthenticatedImage';
import useMediaLightboxStore from '../../store/useMediaLightboxStore';
import { chatColors } from '../../theme/chatDesignTokens';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.35;
const DOUBLE_TAP_SCALE = 2.5;
const PAN_STEP = 48;
const SCALE_EPSILON = 0.01;

const controlButtonSx = {
  color: chatColors.textPrimary,
  bgcolor: 'rgba(255, 255, 255, 0.12)',
  border: `1px solid ${chatColors.borderSubtle}`,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  '&:hover': {
    bgcolor: 'rgba(255, 255, 255, 0.2)',
  },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const defaultTransform = () => ({ scale: MIN_SCALE, x: 0, y: 0 });

function pinchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function normalizeTransform(next, viewport, imageSize) {
  if (next.scale <= MIN_SCALE + SCALE_EPSILON) {
    return defaultTransform();
  }

  if (!viewport?.width || !viewport?.height || !imageSize?.width || !imageSize?.height) {
    return { scale: next.scale, x: next.x, y: next.y };
  }

  const scaledWidth = imageSize.width * next.scale;
  const scaledHeight = imageSize.height * next.scale;
  const maxX = Math.max(0, (scaledWidth - viewport.width) / 2);
  const maxY = Math.max(0, (scaledHeight - viewport.height) / 2);

  return {
    scale: next.scale,
    x: clamp(next.x, -maxX, maxX),
    y: clamp(next.y, -maxY, maxY),
  };
}

const ZoomableLightboxImage = ({
  attachmentId,
  alt,
  initialTransform,
  onZoomChange,
  zoomApiRef,
}) => {
  const viewportRef = useRef(null);
  const [transform, setTransform] = useState(() => initialTransform ?? defaultTransform());
  const [isInteracting, setIsInteracting] = useState(false);
  const [viewportSize, setViewportSize] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const dragStateRef = useRef(null);
  const pinchStateRef = useRef(null);
  const transformRef = useRef(transform);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const measureImage = useCallback((img) => {
    if (!img) return;
    const width = img.clientWidth;
    const height = img.clientHeight;
    if (width > 0 && height > 0) {
      setImageSize({ width, height });
    }
  }, []);

  const measureViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (width > 0 && height > 0) {
      setViewportSize({ width, height });
    }
  }, []);

  useEffect(() => {
    setTransform(initialTransform ?? defaultTransform());
    setImageSize(null);
  }, [attachmentId, initialTransform]);

  useEffect(() => {
    onZoomChange?.(transform.scale > MIN_SCALE + SCALE_EPSILON);
  }, [transform.scale, onZoomChange]);

  useEffect(() => {
    measureViewport();
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const observer = new ResizeObserver(() => {
      measureViewport();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measureViewport]);

  useEffect(() => {
    if (!viewportSize || !imageSize) return;
    setTransform((prev) => normalizeTransform(prev, viewportSize, imageSize));
  }, [viewportSize, imageSize]);

  const commitTransform = useCallback(
    (updater) => {
      setTransform((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return normalizeTransform(next, viewportSize, imageSize);
      });
    },
    [viewportSize, imageSize],
  );

  const applyScale = useCallback(
    (nextScale) => {
      commitTransform((prev) => {
        const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        if (scale <= MIN_SCALE + SCALE_EPSILON) return defaultTransform();
        return { ...prev, scale };
      });
    },
    [commitTransform],
  );

  const zoomBy = useCallback(
    (delta) => {
      commitTransform((prev) => {
        const scale = clamp(prev.scale + delta, MIN_SCALE, MAX_SCALE);
        if (scale <= MIN_SCALE + SCALE_EPSILON) return defaultTransform();
        return { ...prev, scale };
      });
    },
    [commitTransform],
  );

  const panBy = useCallback(
    (dx, dy) => {
      commitTransform((prev) => {
        if (prev.scale <= MIN_SCALE + SCALE_EPSILON) return defaultTransform();
        return { ...prev, x: prev.x + dx, y: prev.y + dy };
      });
    },
    [commitTransform],
  );

  const resetZoom = useCallback(() => {
    setTransform(defaultTransform());
  }, []);

  useEffect(() => {
    if (!zoomApiRef) return;
    zoomApiRef.current = {
      zoomIn: () => zoomBy(ZOOM_STEP),
      zoomOut: () => zoomBy(-ZOOM_STEP),
      reset: resetZoom,
      panBy,
      getTransform: () => ({ ...transformRef.current }),
    };
  }, [zoomApiRef, zoomBy, resetZoom, panBy]);

  const toggleDoubleTapZoom = useCallback(() => {
    commitTransform((prev) =>
      prev.scale > MIN_SCALE + SCALE_EPSILON
        ? defaultTransform()
        : { scale: DOUBLE_TAP_SCALE, x: 0, y: 0 },
    );
  }, [commitTransform]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const onWheel = (event) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      zoomBy(direction * ZOOM_STEP);
    };

    const blockNativeDrag = (event) => {
      event.preventDefault();
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('dragstart', blockNativeDrag);
    viewport.addEventListener('selectstart', blockNativeDrag);

    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('dragstart', blockNativeDrag);
      viewport.removeEventListener('selectstart', blockNativeDrag);
    };
  }, [zoomBy]);

  const onPointerDown = (event) => {
    if (transformRef.current.scale <= MIN_SCALE + SCALE_EPSILON || event.pointerType === 'touch') {
      return;
    }
    event.preventDefault();
    setIsInteracting(true);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    commitTransform((prev) => ({
      ...prev,
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    }));
  };

  const onPointerUp = (event) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setIsInteracting(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onTouchStart = (event) => {
    if (event.touches.length === 2) {
      setIsInteracting(true);
      pinchStateRef.current = {
        distance: pinchDistance(event.touches),
        scale: transform.scale,
      };
    }
  };

  const onTouchMove = (event) => {
    if (event.touches.length !== 2 || !pinchStateRef.current) return;
    event.preventDefault();
    const distance = pinchDistance(event.touches);
    const ratio = distance / pinchStateRef.current.distance;
    applyScale(pinchStateRef.current.scale * ratio);
  };

  const onTouchEnd = () => {
    pinchStateRef.current = null;
    setIsInteracting(false);
  };

  const handleImageLoad = (event) => {
    const img = event.currentTarget;
    measureImage(img);
    img.decode?.().then(() => measureImage(img)).catch(() => {});
  };

  return (
    <Box
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={toggleDoubleTapZoom}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onDragStart={(event) => event.preventDefault()}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitUserDrag: 'none',
        touchAction: transform.scale > MIN_SCALE + SCALE_EPSILON ? 'none' : 'manipulation',
        cursor: transform.scale > MIN_SCALE + SCALE_EPSILON ? 'grab' : 'zoom-in',
        '&:active': {
          cursor: transform.scale > MIN_SCALE + SCALE_EPSILON ? 'grabbing' : 'zoom-in',
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            transformOrigin: 'center center',
            transition: isInteracting ? 'none' : 'transform 0.15s ease-out',
            willChange: 'transform',
            lineHeight: 0,
          }}
        >
          <AuthenticatedImage
            attachmentId={attachmentId}
            alt={alt}
            onLoad={handleImageLoad}
            sx={{
              display: 'block',
              maxWidth: viewportSize?.width ? `${viewportSize.width}px` : '100%',
              maxHeight: viewportSize?.height ? `${viewportSize.height}px` : '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              userSelect: 'none',
              WebkitUserDrag: 'none',
              pointerEvents: 'none',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

function cloneTransform(transform) {
  if (!transform) return defaultTransform();
  return {
    scale: transform.scale,
    x: transform.x,
    y: transform.y,
  };
}

function pruneTransformCache(cache, items, currentIndex) {
  const allowed = new Set();
  for (let i = currentIndex - 1; i <= currentIndex + 1; i += 1) {
    if (i >= 0 && i < items.length) {
      allowed.add(String(items[i].id));
    }
  }
  for (const key of cache.keys()) {
    if (!allowed.has(key)) {
      cache.delete(key);
    }
  }
}

const MediaLightbox = () => {
  const open = useMediaLightboxStore((state) => state.open);
  const items = useMediaLightboxStore((state) => state.items);
  const index = useMediaLightboxStore((state) => state.index);
  const close = useMediaLightboxStore((state) => state.close);
  const next = useMediaLightboxStore((state) => state.next);
  const prev = useMediaLightboxStore((state) => state.prev);

  const current = items[index];
  const hasMultiple = items.length > 1;
  const [isZoomed, setIsZoomed] = useState(false);
  const zoomApiRef = useRef({
    zoomIn: () => {},
    zoomOut: () => {},
    reset: () => {},
    getTransform: () => defaultTransform(),
  });
  const transformCacheRef = useRef(new Map());

  const saveCurrentTransform = useCallback(() => {
    const attachmentId = items[index]?.id;
    if (attachmentId == null) return;
    transformCacheRef.current.set(String(attachmentId), cloneTransform(zoomApiRef.current.getTransform()));
  }, [items, index]);

  const navigateByStep = useCallback(
    (step) => {
      if (items.length <= 1) return;
      const oldIndex = index;
      const newIndex = (oldIndex + step + items.length) % items.length;
      const isAdjacent = Math.abs(newIndex - oldIndex) === 1;

      saveCurrentTransform();

      if (!isAdjacent) {
        transformCacheRef.current.clear();
      }

      if (step > 0) {
        next();
      } else {
        prev();
      }

      pruneTransformCache(transformCacheRef.current, items, newIndex);
    },
    [items, index, saveCurrentTransform, next, prev],
  );

  const goNext = useCallback(() => navigateByStep(1), [navigateByStep]);
  const goPrev = useCallback(() => navigateByStep(-1), [navigateByStep]);

  const initialTransform = useMemo(() => {
    const cached = transformCacheRef.current.get(String(current?.id));
    return cached ? cloneTransform(cached) : defaultTransform();
  }, [current?.id, index]);

  useEffect(() => {
    if (!open) {
      transformCacheRef.current.clear();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (isZoomed) {
          zoomApiRef.current.reset();
          return;
        }
        close();
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomApiRef.current.zoomIn();
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomApiRef.current.zoomOut();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (isZoomed) {
          zoomApiRef.current.panBy(-PAN_STEP, 0);
        } else {
          goNext();
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (isZoomed) {
          zoomApiRef.current.panBy(PAN_STEP, 0);
        } else {
          goPrev();
        }
      } else if (event.key === 'ArrowUp' && isZoomed) {
        event.preventDefault();
        zoomApiRef.current.panBy(0, PAN_STEP);
      } else if (event.key === 'ArrowDown' && isZoomed) {
        event.preventDefault();
        zoomApiRef.current.panBy(0, -PAN_STEP);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close, goNext, goPrev, isZoomed]);

  if (!open || !current) return null;

  return createPortal(
    <Box
      role="dialog"
      aria-modal="true"
      aria-label={current.filename ? `Image viewer: ${current.filename}` : 'Image viewer'}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1600,
        bgcolor: 'var(--chat-backdrop-bg, rgba(12, 8, 24, 0.55))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      <IconButton
        aria-label="Close image viewer"
        onClick={close}
        sx={{
          ...controlButtonSx,
          position: 'absolute',
          top: { xs: 12, sm: 20 },
          right: { xs: 12, sm: 20 },
          zIndex: 2,
        }}
      >
        <CloseIcon />
      </IconButton>

      <Box
        sx={{
          position: 'absolute',
          top: { xs: 12, sm: 20 },
          right: { xs: 64, sm: 84 },
          zIndex: 2,
          display: 'flex',
          gap: 0.5,
        }}
      >
        <IconButton
          aria-label="Zoom out"
          onClick={() => zoomApiRef.current.zoomOut()}
          sx={controlButtonSx}
        >
          <ZoomOutIcon />
        </IconButton>
        <IconButton
          aria-label="Zoom in"
          onClick={() => zoomApiRef.current.zoomIn()}
          sx={controlButtonSx}
        >
          <ZoomInIcon />
        </IconButton>
      </Box>

      {hasMultiple ? (
        <IconButton
          aria-label="Previous image"
          onClick={goPrev}
          sx={{
            ...controlButtonSx,
            position: 'absolute',
            left: { xs: 8, sm: 24 },
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
          }}
        >
          <ChevronLeftIcon sx={{ fontSize: 32 }} />
        </IconButton>
      ) : null}

      {hasMultiple ? (
        <IconButton
          aria-label="Next image"
          onClick={goNext}
          sx={{
            ...controlButtonSx,
            position: 'absolute',
            right: { xs: 8, sm: 24 },
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
          }}
        >
          <ChevronRightIcon sx={{ fontSize: 32 }} />
        </IconButton>
      ) : null}

      <Box
        sx={{
          width: '100%',
          height: '100%',
          px: { xs: 7, sm: 10 },
          py: { xs: 7, sm: 8 },
          boxSizing: 'border-box',
        }}
      >
        <ZoomableLightboxImage
          attachmentId={current.id}
          alt={current.filename || 'Image'}
          initialTransform={initialTransform}
          onZoomChange={setIsZoomed}
          zoomApiRef={zoomApiRef}
        />
      </Box>

      {hasMultiple ? (
        <Box
          aria-live="polite"
          sx={{
            position: 'absolute',
            bottom: { xs: 16, sm: 24 },
            left: '50%',
            transform: 'translateX(-50%)',
            color: chatColors.textSecondary,
            fontSize: '0.8125rem',
            letterSpacing: '0.02em',
            pointerEvents: 'none',
          }}
        >
          {index + 1} / {items.length}
        </Box>
      ) : null}
    </Box>,
    document.body,
  );
};

export default MediaLightbox;
