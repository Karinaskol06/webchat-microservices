import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import chatService from '../../services/chatService';
import { joinInviteErrorMessage, parseInviteToken } from '../../utils/inviteLink';

const VIEW_MENU = 'menu';
const VIEW_INVITE = 'invite';

const ChatSettingsDialog = ({
  open,
  onClose,
  onJoinedRoom,
  /** `join` opens the invite form directly (e.g. from chat list menu). */
  variant = 'settings',
}) => {
  const joinOnly = variant === 'join';
  const [view, setView] = useState(joinOnly ? VIEW_INVITE : VIEW_MENU);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    if (!open) {
      setView(joinOnly ? VIEW_INVITE : VIEW_MENU);
      setInviteInput('');
      setInviteError('');
      setInviteBusy(false);
      return;
    }
    setView(joinOnly ? VIEW_INVITE : VIEW_MENU);
  }, [open, joinOnly]);

  const handleClose = () => {
    onClose?.();
  };

  const handleJoinInvite = async () => {
    const token = parseInviteToken(inviteInput);
    if (!token) {
      setInviteError('Paste an invite link or token.');
      return;
    }
    setInviteBusy(true);
    setInviteError('');
    try {
      const dto = await chatService.joinByInvite(token);
      if (!dto?.id) {
        setInviteError('Join succeeded but room data was missing.');
        return;
      }
      onJoinedRoom?.(dto);
      handleClose();
    } catch (err) {
      setInviteError(joinInviteErrorMessage(err));
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        {view === VIEW_INVITE ? (
          <IconButton
            aria-label={joinOnly ? 'Close' : 'Back to settings'}
            onClick={() => (joinOnly ? handleClose() : setView(VIEW_MENU))}
            edge="start"
            size="small"
          >
            <ArrowBackIcon />
          </IconButton>
        ) : null}
        <Typography component="span" variant="h6" sx={{ flex: 1 }}>
          {view === VIEW_INVITE ? 'Join via link' : 'Settings'}
        </Typography>
        <IconButton aria-label="Close settings" onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: view === VIEW_MENU ? 0 : 2 }}>
        {view === VIEW_MENU ? (
          <List disablePadding>
            <ListItemButton onClick={() => setView(VIEW_INVITE)}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <LinkIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Join via link"
                secondary="Paste a group or channel invite"
              />
            </ListItemButton>
          </List>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Paste an invite link or token from a group or channel admin.
            </Typography>
            <TextField
              size="small"
              fullWidth
              label="Invite link or token"
              placeholder="Paste link or token"
              value={inviteInput}
              disabled={inviteBusy}
              onChange={(e) => {
                setInviteInput(e.target.value);
                if (inviteError) setInviteError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleJoinInvite();
                }
              }}
            />
            {inviteError ? (
              <Alert severity="error" onClose={() => setInviteError('')}>
                {inviteError}
              </Alert>
            ) : null}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                onClick={() => (joinOnly ? handleClose() : setView(VIEW_MENU))}
                disabled={inviteBusy}
              >
                {joinOnly ? 'Cancel' : 'Back'}
              </Button>
              <Button
                variant="contained"
                disabled={inviteBusy || !String(inviteInput).trim()}
                onClick={() => void handleJoinInvite()}
              >
                {inviteBusy ? 'Joining…' : 'Join'}
              </Button>
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ChatSettingsDialog;
