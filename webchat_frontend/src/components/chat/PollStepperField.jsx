import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import { alpha } from '@mui/material/styles';
import { chatRadii } from '../../theme/chatDesignTokens';

/** Compact stepper without native number-input spinners. */
const PollStepperField = ({ label, value, min = 1, max = 10, onChange, disabled = false }) => {
  const clamp = (n) => Math.min(max, Math.max(min, n));

  return (
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
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 0.5,
          py: 0.5,
          borderRadius: `${chatRadii.bubble}px`,
          border: (theme) => `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.03),
        }}
      >
        <IconButton
          size="small"
          aria-label="Decrease tries"
          disabled={disabled || value <= min}
          onClick={() => onChange?.(clamp(value - 1))}
        >
          <RemoveIcon fontSize="small" />
        </IconButton>
        <Typography
          component="span"
          variant="body2"
          fontWeight={700}
          sx={{ minWidth: 28, textAlign: 'center', userSelect: 'none' }}
        >
          {value}
        </Typography>
        <IconButton
          size="small"
          aria-label="Increase tries"
          disabled={disabled || value >= max}
          onClick={() => onChange?.(clamp(value + 1))}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
};

export default PollStepperField;
