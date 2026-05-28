import React from 'react';
import { Box, IconButton, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { alpha } from '@mui/material/styles';
import { chatColors, chatRadii } from '../../theme/chatDesignTokens';
import { serializePayload } from '../../utils/personalSpace';
import { useRichMessageDraft } from '../../hooks/useRichMessageDraft';

const CalloutMessage = ({ payload, editable, onUpdate, onDelete, messageId }) => {
  const icon = payload?.icon || '💡';
  const {
    draft: draftText,
    setDraft: setDraftText,
    onFocus: onTextFocus,
    onBlur: onTextBlur,
  } = useRichMessageDraft(`${messageId}-text`, payload?.text ?? '', '');

  const {
    draft: draftIcon,
    setDraft: setDraftIcon,
    onFocus: onIconFocus,
    onBlur: onIconBlur,
  } = useRichMessageDraft(`${messageId}-icon`, icon, '💡');

  const persist = (patch) => {
    onUpdate?.(serializePayload({ ...payload, ...patch }));
  };

  const flushText = (value) => {
    const next = value ?? draftText;
    if ((payload?.text ?? '') === next) return;
    persist({ text: next });
  };

  const flushIcon = (value) => {
    const next = (value ?? draftIcon).slice(0, 4) || '💡';
    if ((payload?.icon ?? '💡') === next) return;
    persist({ icon: next });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        width: '100%',
        maxWidth: 520,
        px: 2,
        py: 1.75,
        borderRadius: `${chatRadii.md}px`,
        bgcolor: alpha(chatColors.primary, 0.12),
        border: `1px solid ${alpha(chatColors.primary, 0.28)}`,
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      }}
    >
      {editable ? (
        <TextField
          value={draftIcon}
          onChange={(e) => setDraftIcon(e.target.value.slice(0, 4))}
          onFocus={onIconFocus}
          onBlur={() => onIconBlur(flushIcon)}
          variant="standard"
          inputProps={{ maxLength: 4, 'aria-label': 'Callout icon' }}
          sx={{
            width: 40,
            flexShrink: 0,
            '& .MuiInput-input': {
              fontSize: '1.35rem',
              textAlign: 'center',
              p: 0,
              color: chatColors.textPrimary,
            },
          }}
        />
      ) : (
        <Typography
          component="span"
          aria-hidden
          sx={{ fontSize: '1.35rem', lineHeight: 1.4, flexShrink: 0 }}
        >
          {icon}
        </Typography>
      )}

      <Box flex={1} minWidth={0}>
        {editable ? (
          <TextField
            fullWidth
            multiline
            minRows={1}
            maxRows={6}
            placeholder="Write a reminder…"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onFocus={onTextFocus}
            onBlur={() => onTextBlur(flushText)}
            variant="standard"
            InputProps={{ disableUnderline: true }}
            sx={{
              '& .MuiInputBase-input': {
                color: chatColors.textPrimary,
                fontSize: '0.9375rem',
                '&::placeholder': {
                  color: chatColors.textSecondary,
                  opacity: 1,
                },
              },
            }}
          />
        ) : (
          <Typography
            variant="body2"
            sx={{ color: chatColors.textPrimary, whiteSpace: 'pre-wrap' }}
          >
            {payload?.text || '—'}
          </Typography>
        )}
      </Box>

      {editable && onDelete ? (
        <IconButton
          size="small"
          aria-label="Delete callout"
          onClick={onDelete}
          sx={{ color: chatColors.textSecondary, flexShrink: 0 }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Box>
  );
};

export default CalloutMessage;
