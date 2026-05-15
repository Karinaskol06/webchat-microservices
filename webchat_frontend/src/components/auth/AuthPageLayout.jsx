import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
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
  const { pathname } = useLocation();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

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
          ...(entered ? authCardEnterSx : { opacity: 0 }),
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
