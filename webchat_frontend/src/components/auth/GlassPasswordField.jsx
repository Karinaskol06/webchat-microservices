import React, { useLayoutEffect, useRef, useState } from 'react';
import { IconButton, InputAdornment } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import GlassTextField from './GlassTextField';
import useTranslation from '../../hooks/useTranslation';

const canMaskWithTextSecurity =
  typeof CSS !== 'undefined' && CSS.supports('-webkit-text-security', 'disc');

const assignHtmlInputRef = (node, externalRef) => {
  if (typeof externalRef === 'function') {
    externalRef(node);
  } else if (externalRef && typeof externalRef === 'object') {
    externalRef.current = node;
  }
};

const GlassPasswordField = (props) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const pendingSelectionRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);

  useLayoutEffect(() => {
    if (canMaskWithTextSecurity) return;

    const pending = pendingSelectionRef.current;
    if (!pending) return;

    const restore = () => {
      const input = inputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(pending.start, pending.end);
    };

    restore();
    requestAnimationFrame(restore);
    pendingSelectionRef.current = null;
  }, [showPassword]);

  const handleToggleVisibility = () => {
    if (!canMaskWithTextSecurity) {
      const input = inputRef.current;
      if (input) {
        pendingSelectionRef.current = {
          start: input.selectionStart ?? input.value.length,
          end: input.selectionEnd ?? input.value.length,
        };
      }
    }
    setShowPassword((visible) => !visible);
  };

  const htmlInputSlot = props.slotProps?.htmlInput ?? {};
  const maskStyle =
    canMaskWithTextSecurity && !showPassword ? { WebkitTextSecurity: 'disc' } : null;

  return (
    <GlassTextField
      {...props}
      type={canMaskWithTextSecurity ? 'text' : showPassword ? 'text' : 'password'}
      slotProps={{
        ...props.slotProps,
        htmlInput: {
          ...htmlInputSlot,
          ref: (node) => {
            inputRef.current = node;
            assignHtmlInputRef(node, htmlInputSlot.ref);
          },
          style: {
            ...(htmlInputSlot.style ?? {}),
            ...maskStyle,
          },
        },
        input: {
          ...props.slotProps?.input,
          endAdornment: (
            <InputAdornment position="end" sx={{ mr: 1.25 }}>
              <IconButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleToggleVisibility}
                disabled={props.disabled}
                aria-label={showPassword ? t('auth.password.hide') : t('auth.password.show')}
                sx={{
                  color: 'rgba(255, 255, 255, 0.92)',
                  p: 0.75,
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
                }}
              >
                {showPassword ? (
                  <VisibilityOffOutlinedIcon sx={{ fontSize: 22 }} />
                ) : (
                  <VisibilityOutlinedIcon sx={{ fontSize: 22 }} />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
};

export default GlassPasswordField;
