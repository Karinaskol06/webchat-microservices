import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { STICKY_NOTE_COLORS, serializePayload } from '../../utils/personalSpace';
import { clampStickyToContent, getStickyContentBounds } from '../../utils/stickyNoteLayout';
import { useRichMessageDraft } from '../../hooks/useRichMessageDraft';

const StickyNoteMessage = ({
  payload,
  editable,
  onUpdate,
  onDelete,
  floating = false,
  onDragMove,
  onDragEnd,
  messageId,
  viewportRef,
  contentRef,
}) => {
  const [dragging, setDragging] = useState(false);
  const [textFocused, setTextFocused] = useState(false);
  const [localColor, setLocalColor] = useState(null);
  const rafRef = useRef(null);
  const pendingMoveRef = useRef(null);
  const payloadColor = payload?.color || STICKY_NOTE_COLORS[0];
  const color = localColor ?? payloadColor;

  useEffect(() => {
    if (localColor != null && payloadColor === localColor) {
      setLocalColor(null);
    }
  }, [localColor, payloadColor]);

  const {
    draft: draftText,
    setDraft: setDraftText,
    onFocus: onTextFocus,
    onBlur: onTextBlur,
  } = useRichMessageDraft(`${messageId}-sticky`, payload?.text ?? '', '');

  const flushText = (value) => {
    const next = value ?? draftText;
    if ((payload?.text ?? '') === next) return;
    onUpdate?.(serializePayload({ ...payload, text: next, color }));
  };

  const getBounds = () =>
    getStickyContentBounds(viewportRef?.current, contentRef?.current);

  const pointerToContent = (clientX, clientY, offsetX, offsetY) => {
    const viewport = viewportRef?.current;
    if (!viewport) {
      return {
        x: Number(payload?.x) || 0,
        y: Number(payload?.y) || 0,
      };
    }
    const rect = viewport.getBoundingClientRect();
    const x = clientX - rect.left + viewport.scrollLeft - offsetX;
    const y = clientY - rect.top + viewport.scrollTop - offsetY;
    return clampStickyToContent(x, y, getBounds());
  };

  const scheduleDragMove = (position) => {
    pendingMoveRef.current = position;
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingMoveRef.current;
      pendingMoveRef.current = null;
      if (pending) {
        onDragMove?.({
          ...payload,
          text: draftText,
          color,
          x: pending.x,
          y: pending.y,
        });
      }
    });
  };

  const handleColorChange = (nextColor) => {
    setLocalColor(nextColor);
    onUpdate?.(serializePayload({ ...payload, text: draftText, color: nextColor }));
  };

  const handlePointerDown = (e) => {
    if (!floating || !editable || !onDragEnd) return;
    if (e.target.closest('textarea, input, button, [role="button"], [data-sticky-no-drag]')) return;
    e.preventDefault();

    const stickyRect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - stickyRect.left;
    const offsetY = e.clientY - stickyRect.top;
    setDragging(true);

    const onMove = (moveEvent) => {
      scheduleDragMove(pointerToContent(moveEvent.clientX, moveEvent.clientY, offsetX, offsetY));
    };

    const onUp = (upEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingMoveRef.current = null;
      setDragging(false);
      const finalPos = pointerToContent(upEvent.clientX, upEvent.clientY, offsetX, offsetY);
      onDragEnd?.({
        ...payload,
        text: draftText,
        color,
        x: finalPos.x,
        y: finalPos.y,
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <Box
      onPointerDown={handlePointerDown}
      sx={{
        width: floating ? 200 : { xs: '100%', sm: 220 },
        minHeight: 140,
        p: 1.5,
        borderRadius: 1,
        bgcolor: color,
        boxShadow: dragging
          ? '0 12px 28px rgba(0,0,0,0.22)'
          : '0 4px 14px rgba(0,0,0,0.12), 2px 3px 0 rgba(0,0,0,0.06)',
        transform: dragging ? 'rotate(-1deg) scale(1.02)' : 'rotate(-0.5deg)',
        transition: dragging ? 'none' : 'box-shadow 0.2s ease, transform 0.2s ease',
        cursor:
          floating && editable && !textFocused
            ? dragging
              ? 'grabbing'
              : 'grab'
            : 'default',
        userSelect: dragging ? 'none' : 'auto',
        position: 'relative',
        touchAction: floating && editable ? 'none' : 'auto',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: -6,
          right: 16,
          width: 40,
          height: 12,
          bgcolor: color,
          opacity: 0.45,
          borderRadius: 1,
        },
      }}
    >
      {editable && onDelete ? (
        <IconButton
          size="small"
          aria-label="Delete sticky note"
          onClick={onDelete}
          sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.5)' }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      ) : null}

      {editable ? (
        <TextField
          multiline
          minRows={4}
          fullWidth
          placeholder="Write a note…"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onFocus={() => {
            setTextFocused(true);
            onTextFocus();
          }}
          onBlur={() => {
            setTextFocused(false);
            onTextBlur(flushText);
          }}
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{
            mt: 2,
            cursor: 'text',
            '& .MuiInputBase-root': {
              cursor: 'text',
            },
            '& .MuiInputBase-input': {
              fontFamily: '"Segoe Print", "Comic Sans MS", cursive, sans-serif',
              fontSize: '0.95rem',
              color: '#1a1a1a',
              cursor: 'text',
              caretColor: '#1a1a1a',
            },
          }}
        />
      ) : (
        <Typography
          variant="body2"
          sx={{
            mt: 2,
            whiteSpace: 'pre-wrap',
            fontFamily: '"Segoe Print", "Comic Sans MS", cursive, sans-serif',
            color: '#1a1a1a',
            minHeight: 80,
          }}
        >
          {payload?.text || ' '}
        </Typography>
      )}

      {editable ? (
        <Box display="flex" gap={0.5} mt={1} flexWrap="wrap" data-sticky-no-drag>
          {STICKY_NOTE_COLORS.map((c) => (
            <Box
              key={c}
              role="button"
              tabIndex={0}
              aria-label={`Note color ${c}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => handleColorChange(c)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleColorChange(c);
                }
              }}
              sx={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                bgcolor: c,
                border: c === color ? '2px solid #333' : '1px solid rgba(0,0,0,0.2)',
                cursor: 'pointer',
              }}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

export default StickyNoteMessage;