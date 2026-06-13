import React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { chatRadii } from '../../theme/chatDesignTokens';

/**
 * Two-option segmented control — clear tap targets, no sliding thumb (Fitts / recognition over recall).
 */
const BinaryChoiceField = ({ label, value, options, onChange, disabled = false }) => (
  <Box>
    {label ? (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 0.75, display: 'block', fontWeight: 600, letterSpacing: '0.02em' }}
      >
        {label}
      </Typography>
    ) : null}
    <Box
      role="group"
      aria-label={label}
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: 0.75,
        p: 0.75,
        borderRadius: `${chatRadii.bubble}px`,
        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.04),
        border: (theme) => `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
      }}
    >
      {options.map(({ id, label: optionLabel }) => {
        const selected = value === id;
        return (
          <Box
            key={id}
            component="button"
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange?.(id)}
            sx={{
              minHeight: 40,
              px: 1.25,
              py: 1,
              border: 'none',
              borderRadius: `${Math.max(chatRadii.bubble - 4, 8)}px`,
              cursor: disabled ? 'not-allowed' : 'pointer',
              font: 'inherit',
              fontSize: '0.8125rem',
              fontWeight: selected ? 700 : 500,
              lineHeight: 1.25,
              color: selected ? 'primary.contrastText' : 'text.primary',
              bgcolor: selected ? 'primary.main' : 'transparent',
              opacity: disabled ? 0.55 : 1,
              transition: 'background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
              boxShadow: selected ? (theme) => `0 1px 3px ${alpha(theme.palette.primary.main, 0.35)}` : 'none',
              '&:hover': disabled
                ? {}
                : {
                    bgcolor: selected ? 'primary.main' : (theme) => alpha(theme.palette.text.primary, 0.06),
                  },
              '&:focus-visible': {
                outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
            }}
          >
            {optionLabel}
          </Box>
        );
      })}
    </Box>
  </Box>
);

export default BinaryChoiceField;
