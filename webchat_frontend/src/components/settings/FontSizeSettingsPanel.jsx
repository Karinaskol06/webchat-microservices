import React from 'react';
import { Box, Slider, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import useAppearanceStore from '../../store/useAppearanceStore';
import useTranslation from '../../hooks/useTranslation';
import { chatColors, chatRadii } from '../../theme/chatDesignTokens';
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
} from '../../theme/applyFontScale';

const FontSizeSettingsPanel = () => {
  const { t } = useTranslation();
  const fontScale = useAppearanceStore((state) => state.fontScale);
  const setFontScale = useAppearanceStore((state) => state.setFontScale);

  const marks = [
    { value: FONT_SCALE_MIN, label: t('fontSize.small') },
    { value: FONT_SCALE_DEFAULT, label: t('fontSize.default') },
    { value: FONT_SCALE_MAX, label: t('fontSize.large') },
  ];

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {t('fontSize.subtitle')}
      </Typography>

      <Slider
        value={fontScale}
        min={FONT_SCALE_MIN}
        max={FONT_SCALE_MAX}
        step={0.025}
        marks={marks}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
        onChange={(_, value) => setFontScale(value)}
        aria-label={t('fontSize.sliderAria')}
        sx={{ mx: 0.5, mb: 1 }}
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {t('fontSize.current', { percent: Math.round(fontScale * 100) })}
      </Typography>

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        {t('fontSize.previewTitle')}
      </Typography>

      <Box
        sx={{
          borderRadius: `${chatRadii.panel}px`,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.03),
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {t('fontSize.preview.chatList')}
          </Typography>
          <Box
            sx={{
              mt: 1,
              px: 1.5,
              py: 1,
              borderRadius: `${chatRadii.bubble}px`,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {t('fontSize.preview.contactName')}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {t('fontSize.preview.lastMessage')}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: chatColors.conversationBg,
          }}
        >
          <Typography variant="caption" sx={{ color: chatColors.textSecondary, fontWeight: 600 }}>
            {t('fontSize.preview.conversation')}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25 }}>
            <Box
              sx={{
                maxWidth: '82%',
                px: 1.5,
                py: 1,
                borderRadius: `${chatRadii.bubble}px`,
                bgcolor: chatColors.bubbleOutgoing,
                color: chatColors.bubbleText,
              }}
            >
              <Typography variant="body1" sx={{ color: 'inherit' }}>
                {t('fontSize.preview.message')}
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 0.5, color: 'rgba(255,255,255,0.72)' }}
              >
                12:34
              </Typography>
            </Box>
          </Box>
          <Typography
            variant="body2"
            sx={{
              mt: 1.25,
              px: 1.5,
              py: 1,
              borderRadius: 999,
              bgcolor: chatColors.composerInputBg,
              color: chatColors.textSecondary,
            }}
          >
            {t('fontSize.preview.composer')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default FontSizeSettingsPanel;
