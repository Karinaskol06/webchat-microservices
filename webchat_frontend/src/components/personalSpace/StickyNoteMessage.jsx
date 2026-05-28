import React, { useState } from 'react';
import { Box, IconButton, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { STICKY_NOTE_COLORS, serializePayload } from '../../utils/personalSpace';
import { useRichMessageDraft } from '../../hooks/useRichMessageDraft';

const StickyNoteMessage = ({
  payload,
  editable,
  onUpdate,
  onDelete,
  floating = false,
  onDragEnd,
  messageId,
}) => {
  const [dragging, setDragging] = useState(false);
  const color = payload?.color || STICKY_NOTE_COLORS[0];

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

  const handlePointerDown = (e) => {
    if (!floating || !editable || !onDragEnd) return;
    if (e.target.closest('textarea, input, button')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = Number(payload?.x) || 0;
    const originY = Number(payload?.y) || 0;
    setDragging(true);

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      onDragEnd(
        serializePayload({
          ...payload,
          text: draftText,
          color,
          x: Math.max(0, originX + dx),
          y: Math.max(0, originY + dy),
        }),
        { live: true },
      );
    };

    const onUp = (upEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragging(false);
      const dx = upEvent.clientX - startX;
      const dy = upEvent.clientY - startY;
      onDragEnd(
        serializePayload({
          ...payload,
          text: draftText,
          color,
          x: Math.max(0, originX + dx),
          y: Math.max(0, originY + dy),
        }),
        { live: false },
      );
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
        cursor: floating && editable ? 'grab' : 'default',
        userSelect: dragging ? 'none' : 'auto',
        position: 'relative',
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
          onFocus={onTextFocus}
          onBlur={() => onTextBlur(flushText)}
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{
            mt: 2,
            '& .MuiInputBase-input': {
              fontFamily: '"Segoe Print", "Comic Sans MS", cursive, sans-serif',
              fontSize: '0.95rem',
              color: '#1a1a1a',
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
        <Box display="flex" gap={0.5} mt={1} flexWrap="wrap">
          {STICKY_NOTE_COLORS.map((c) => (
            <Box
              key={c}
              role="button"
              tabIndex={0}
              aria-label={`Note color ${c}`}
              onClick={() => onUpdate?.(serializePayload({ ...payload, text: draftText, color: c }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onUpdate?.(serializePayload({ ...payload, text: draftText, color: c }));
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
