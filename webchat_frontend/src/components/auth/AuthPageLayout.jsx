import React, { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import {
  authBgLayerSx,
  authCardEnterSx,
  authFooterEnterSx,
  authShakeSx,
  authTitleEnterSx,
} from './authAnimations';
import {
  authFooterSx,
  authGlassCardSx,
  authPageRootSx,
  authTitleSx,
  AUTH_BG_IMAGE,
} from './authPageTheme';

const AuthPageLayout = ({ title, children, footer, maxWidth = 420, shake = false }) => {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  return (
    <Box
      component="main"
      sx={{
        ...authPageRootSx,
        backgroundImage: `url(${AUTH_BG_IMAGE})`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          ...authBgLayerSx,
          backgroundImage: `url(${AUTH_BG_IMAGE})`,
        }}
      />
      <Box
        sx={{
          ...authGlassCardSx,
          maxWidth,
          ...authCardEnterSx,
          ...authShakeSx(shake),
        }}
        role="region"
        aria-label={title}
      >
        <Typography component="h1" variant="h4" sx={{ ...authTitleSx, ...authTitleEnterSx }}>
          {title}
        </Typography>
        {children}
        {footer ? (
          <Box sx={{ ...authFooterSx, ...authFooterEnterSx }}>{footer}</Box>
        ) : null}
      </Box>
    </Box>
  );
};

export default AuthPageLayout;
