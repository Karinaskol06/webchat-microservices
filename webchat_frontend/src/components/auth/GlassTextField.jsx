import React from 'react';
import { InputAdornment, TextField } from '@mui/material';
import { glassFieldSx } from './authPageTheme';

const GlassTextField = ({
  endIcon: EndIcon,
  sx,
  slotProps,
  ...props
}) => (
  <TextField
    fullWidth
    variant="outlined"
    hiddenLabel
    sx={{ ...glassFieldSx, mb: 1.75, ...sx }}
    slotProps={{
      ...slotProps,
      input: {
        ...slotProps?.input,
        endAdornment: EndIcon ? (
          <InputAdornment position="end" sx={{ mr: 1.25 }}>
            <EndIcon
              sx={{
                color: 'rgba(255, 255, 255, 0.92)',
                fontSize: 22,
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                '.Mui-focused &': {
                  opacity: 1,
                  transform: 'scale(1.05)',
                },
              }}
              aria-hidden
            />
          </InputAdornment>
        ) : (
          slotProps?.input?.endAdornment
        ),
      },
    }}
    {...props}
  />
);

export default GlassTextField;
