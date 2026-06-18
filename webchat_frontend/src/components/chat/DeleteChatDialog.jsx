import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import useTranslation from '../../hooks/useTranslation';
import { canDeleteRoom, isGroupOrChannelType } from '../../utils/channelPermissions';

const DeleteChatDialog = ({
  open,
  chat,
  chatLabel = '',
  loading = false,
  error = '',
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
}) => {
  const { t } = useTranslation();
  const [confirmEveryoneStep, setConfirmEveryoneStep] = useState(0);

  const isGroupOrChannel = isGroupOrChannelType(chat);
  const showDeleteForEveryone = isGroupOrChannel ? canDeleteRoom(chat) : true;
  const introLabel = isGroupOrChannel
    ? chatLabel
    : t('chat.delete.chatWith', { chatLabel });

  const handleClose = () => {
    if (loading) return;
    onClose?.();
  };

  const title =
    confirmEveryoneStep === 2
      ? t('chat.delete.forEveryone.step2.title')
      : t('chat.delete.title');

  return (
    <Dialog
      key={open ? 'delete-chat-open' : 'delete-chat-closed'}
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1, pr: 6 }}>{title}</DialogTitle>
      <DialogContent sx={{ pt: 0.5, pb: 0 }}>
        {confirmEveryoneStep === 0 ? (
          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {t('chat.delete.intro', { chatLabel: introLabel })}
            </Typography>

            <Box
              component="button"
              type="button"
              disabled={loading}
              onClick={() => onDeleteForMe?.()}
              sx={{
                width: '100%',
                p: 2.25,
                borderRadius: 3,
                border: 'none',
                bgcolor: 'action.hover',
                textAlign: 'left',
                cursor: loading ? 'default' : 'pointer',
                transition: 'background-color 180ms ease, transform 180ms ease',
                '&:hover': loading
                  ? {}
                  : {
                      bgcolor: 'action.selected',
                      transform: 'translateY(-1px)',
                    },
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                {isGroupOrChannel
                  ? t('chat.delete.forMe.groupTitle')
                  : t('chat.delete.forMe.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                {isGroupOrChannel
                  ? t('chat.delete.forMe.groupBody')
                  : t('chat.delete.forMe.body')}
              </Typography>
            </Box>

            {showDeleteForEveryone ? (
              <Box
                component="button"
                type="button"
                disabled={loading}
                onClick={() => setConfirmEveryoneStep(isGroupOrChannel ? 1 : 2)}
                sx={{
                  width: '100%',
                  p: 2.25,
                  borderRadius: 3,
                  border: 'none',
                  bgcolor: 'rgba(255, 255, 255, 0.06)',
                  textAlign: 'left',
                  cursor: loading ? 'default' : 'pointer',
                  transition: 'background-color 180ms ease, transform 180ms ease',
                  '&:hover': loading
                    ? {}
                    : {
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        transform: 'translateY(-1px)',
                      },
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, color: 'text.primary' }}>
                  {isGroupOrChannel
                    ? t('chat.delete.forEveryone.groupTitle')
                    : t('chat.delete.forEveryone.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                  {isGroupOrChannel
                    ? t('chat.delete.forEveryone.groupBody')
                    : t('chat.delete.forEveryone.body')}
                </Typography>
              </Box>
            ) : null}
          </Stack>
        ) : (
          <Stack spacing={1.25}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {confirmEveryoneStep === 1
                ? t('chat.delete.forEveryone.step1.body', { chatLabel })
                : t('chat.delete.forEveryone.step2.body', { chatLabel })}
            </Typography>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                bgcolor: 'rgba(255, 255, 255, 0.06)',
              }}
            >
              <Typography variant="body2" color="text.primary" fontWeight={600}>
                {confirmEveryoneStep === 1
                  ? t('chat.delete.forEveryone.warning')
                  : t('chat.delete.forEveryone.finalWarning')}
              </Typography>
            </Box>
          </Stack>
        )}
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 0, mt: 1 }}>
        {confirmEveryoneStep === 0 ? (
          <Button onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
        ) : (
          <>
            <Button onClick={() => setConfirmEveryoneStep(0)} disabled={loading}>
              {t('common.back')}
            </Button>
              <Button
              color="error"
              variant="contained"
              disabled={loading}
              onClick={() =>
                confirmEveryoneStep === 1
                  ? setConfirmEveryoneStep(2)
                  : onDeleteForEveryone?.()
              }
              sx={{ minWidth: 170 }}
            >
              {confirmEveryoneStep === 1
                ? t('room.delete.continue')
                : loading
                  ? t('common.deleting')
                  : t('chat.delete.forEveryone.confirm')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DeleteChatDialog;
