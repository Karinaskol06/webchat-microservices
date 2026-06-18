import React, { useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, TextField } from "@mui/material";
import { COUNTRY_PHONE_OPTIONS, COUNTRY_PHONE_OPTIONS_FOR_PARSE } from "../../constants/countryPhoneOptions";
import { combinePhone, isValidInternationalPhone, PHONE_FORMAT_HINT, splitPhoneToDialNational } from "../../utils/internationalPhone";
import {
  authHideScrollbarSx,
  glassCountryDropdownListboxSx,
  glassCountryDropdownOptionSx,
  glassCountryDropdownPaperSx,
  glassFieldSx,
} from "../auth/authPageTheme";
import {
  chatDetailDropdownListboxSx,
  chatDetailDropdownOptionSx,
  chatDetailDropdownPaperSx,
} from "../../theme/chatDesignTokens";
import useTranslation from "../../hooks/useTranslation";

const optionLabel = (o) => `${o.label} (${o.dial})`;

const glassAutocompleteSx = {
  ...glassFieldSx,
  "& .MuiAutocomplete-input": {
    py: "0 !important",
  },
};

export default function PhoneCountryField({
  label,
  phoneNumber,
  countryCode,
  onChange,
  disabled,
  glass = false,
  variant = glass ? "glass" : "default",
}) {
  const { t } = useTranslation();
  const isGlass = variant === "glass";
  const isDetail = variant === "detail";
  const [national, setNational] = useState("");

  const selected = useMemo(() => {
    const iso = (countryCode || "").toUpperCase();
    return COUNTRY_PHONE_OPTIONS.find((o) => o.iso === iso) || COUNTRY_PHONE_OPTIONS.find((o) => o.iso === "UA");
  }, [countryCode]);

  useEffect(() => {
    const { national: n } = splitPhoneToDialNational(phoneNumber, COUNTRY_PHONE_OPTIONS_FOR_PARSE, countryCode);
    setNational(n);
  }, [phoneNumber, countryCode]);

  const full = combinePhone(selected.dial, national);
  const showError = national.length > 0 && !isValidInternationalPhone(full);
  const helper = showError ? t("phone.error.invalid") : isGlass ? undefined : PHONE_FORMAT_HINT;

  const emit = (nextIso, nextNational) => {
    const opt = COUNTRY_PHONE_OPTIONS.find((o) => o.iso === nextIso) || COUNTRY_PHONE_OPTIONS.find((o) => o.iso === "UA");
    const combined = combinePhone(opt.dial, nextNational);
    onChange({ phoneNumber: combined, countryCode: opt.iso });
  };

  const fieldSx = isGlass ? glassFieldSx : undefined;
  const autoSx = isGlass ? glassAutocompleteSx : undefined;

  const dropdownSlotProps = isGlass
    ? {
        popper: { sx: { zIndex: 1500 } },
        paper: { sx: glassCountryDropdownPaperSx },
        listbox: { sx: glassCountryDropdownListboxSx },
      }
    : isDetail
      ? {
          popper: { sx: { zIndex: 1500 } },
          paper: { sx: chatDetailDropdownPaperSx },
          listbox: { sx: chatDetailDropdownListboxSx },
        }
      : {
          listbox: {
            sx: {
              maxHeight: 320,
              ...authHideScrollbarSx,
            },
          },
        };

  const optionSx = isGlass
    ? glassCountryDropdownOptionSx
    : isDetail
      ? chatDetailDropdownOptionSx
      : undefined;

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <Autocomplete
        sx={{ width: isGlass ? 148 : 200, flexShrink: 0, ...autoSx }}
        disabled={disabled}
        options={COUNTRY_PHONE_OPTIONS}
        getOptionLabel={optionLabel}
        isOptionEqualToValue={(a, b) => a.iso === b.iso}
        value={selected}
        onChange={(_, opt) => {
          if (!opt) return;
          emit(opt.iso, national);
        }}
        slotProps={dropdownSlotProps}
        renderOption={(props, option) => {
          const { key, ...optionProps } = props;
          return (
            <Box
              component="li"
              key={key}
              {...optionProps}
              sx={optionSx}
            >
              {optionLabel(option)}
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            hiddenLabel={isGlass}
            label={isGlass ? undefined : t("phone.country.label")}
            placeholder={isGlass ? t("phone.country.label") : undefined}
            inputProps={{
              ...params.inputProps,
              readOnly: true,
              onPaste: (e) => e.preventDefault(),
            }}
          />
        )}
      />
      <TextField
        fullWidth
        hiddenLabel={isGlass}
        label={isGlass ? undefined : (label ?? t("phone.number.label"))}
        placeholder={isGlass ? t("phone.number.label") : undefined}
        value={national}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "");
          setNational(v);
          emit(selected.iso, v);
        }}
        error={showError}
        helperText={helper}
        sx={fieldSx}
        slotProps={{ htmlInput: { "aria-describedby": undefined } }}
      />
    </Box>
  );
}
