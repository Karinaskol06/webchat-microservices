import React from 'react';
import { Alert, Collapse } from '@mui/material';
import { AUTH_EASE, AUTH_EASE_OUT } from './authAnimations';
import { authErrorAlertSx } from './authPageTheme';

const AuthErrorAlert = ({ message }) => (
  <Collapse
    in={Boolean(message)}
    timeout={{ enter: 300, exit: 220 }}
    TransitionProps={{
      easing: {
        enter: AUTH_EASE_OUT,
        exit: AUTH_EASE,
      },
    }}
    unmountOnExit
  >
    <Alert
      severity="error"
      sx={authErrorAlertSx}
      role="alert"
      aria-live="polite"
    >
      {message}
    </Alert>
  </Collapse>
);

export default AuthErrorAlert;
