import React from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Radio,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { LOCALE_OPTIONS } from '../../i18n';
import useTranslation from '../../hooks/useTranslation';

const LanguageSettingsPanel = () => {
  const { t, locale, setLocale } = useTranslation();

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('language.subtitle')}
      </Typography>
      <List disablePadding sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        {LOCALE_OPTIONS.map(({ code, label }, index) => {
          const selected = locale === code;
          return (
            <ListItemButton
              key={code}
              onClick={() => setLocale(code)}
              divider={index < LOCALE_OPTIONS.length - 1}
              aria-pressed={selected}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Radio
                  checked={selected}
                  icon={<RadioButtonUncheckedIcon />}
                  checkedIcon={<CheckCircleIcon color="primary" />}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
};

export default LanguageSettingsPanel;
