import React from 'react';
import { Box } from '@mui/material';
import { authRevealSx } from './authAnimations';

/**
 * Staggered fade-up reveal for auth form sections.
 * @param {number} index - Stagger index (0-based)
 */
const AuthAnimatedItem = ({ index = 0, sx, children, ...props }) => (
  <Box sx={{ ...authRevealSx(index), ...sx }} {...props}>
    {children}
  </Box>
);

export default AuthAnimatedItem;
