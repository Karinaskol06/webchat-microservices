import React from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import useAppearanceStore from '../../store/useAppearanceStore';
import { chatThemeList } from '../../theme/chatThemePresets';
import { chatColors, chatRadii, chatHideScrollbarSx } from '../../theme/chatDesignTokens';
import useTranslation from '../../hooks/useTranslation';

const ThemePickerDialog = ({ open, onClose }) => {
  const themeId = useAppearanceStore((s) => s.themeId);
  const setThemeId = useAppearanceStore((s) => s.setThemeId);
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Typography component="span" variant="h6" sx={{ flex: 1 }}>
          {t('themes.title')}
        </Typography>
        <IconButton aria-label={t('themes.close')} onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          pt: 2,
          ...chatHideScrollbarSx,
          overflowX: 'hidden',
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('themes.intro')}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 2,
          }}
        >
          {chatThemeList.map((preset) => {
            const selected = preset.id === themeId;
            return (
              <Box
                key={preset.id}
                component="button"
                type="button"
                aria-pressed={selected}
                aria-label={`${preset.name} theme${selected ? t('themes.presetSelected') : ''}`}
                onClick={() => setThemeId(preset.id)}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  p: 0,
                  m: 0,
                  border: '2px solid',
                  borderColor: selected ? chatColors.primary : 'rgba(255, 255, 255, 0.16)',
                  borderRadius: `${chatRadii.panel}px`,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'transparent',
                  textAlign: 'left',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease',
                  boxShadow: selected ? '0 0 0 3px var(--chat-primary-focus-ring)' : 'none',
                  '&:hover': {
                    borderColor: selected ? chatColors.primary : 'rgba(255, 255, 255, 0.35)',
                    transform: 'translateY(-1px)',
                  },
                  '&:focus-visible': {
                    outline: `2px solid ${chatColors.primary}`,
                    outlineOffset: 2,
                  },
                }}
              >
                <Box
                  sx={{
                    height: 120,
                    backgroundImage: `url(${preset.bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    px: 1.5,
                    py: 1.25,
                    bgcolor: preset.colors.conversationBg,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: chatColors.textPrimary }}>
                    {preset.name}
                  </Typography>
                  {selected ? (
                    <CheckCircleIcon sx={{ fontSize: 20, color: chatColors.primary }} aria-hidden />
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ThemePickerDialog;
