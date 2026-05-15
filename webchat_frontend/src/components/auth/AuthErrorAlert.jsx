import React from 'react';
import { Alert, Collapse } from '@mui/material';
import { authAlertEnterSx, authShakeSx } from './authAnimations';
import { authErrorAlertSx } from './authPageTheme';

const AuthErrorAlert = ({ message, shake = false }) => (
  <Collapse in={Boolean(message)} timeout={{ enter: 280, exit: 200 }}>
    <Alert
      severity="error"
      sx={{
        ...authErrorAlertSx,
        ...authAlertEnterSx,
        ...authShakeSx(shake),
      }}
      role="alert"
    >
      {message}
    </Alert>
  </Collapse>
);

export default AuthErrorAlert;
