import React, { useEffect, useMemo, useState } from "react";
import { Autocomplete, Box, TextField } from "@mui/material";
import { COUNTRY_PHONE_OPTIONS, COUNTRY_PHONE_OPTIONS_FOR_PARSE } from "../../constants/countryPhoneOptions";
import { combinePhone, isValidInternationalPhone, PHONE_FORMAT_HINT, splitPhoneToDialNational } from "../../utils/internationalPhone";
import { glassFieldSx } from "../auth/authPageTheme";

const optionLabel = (o) => `${o.label} (${o.dial})`;

const glassAutocompleteSx = {
  ...glassFieldSx,
  "& .MuiAutocomplete-input": {
    py: "0 !important",
  },
};

export default function PhoneCountryField({
  label = "Phone number",
  phoneNumber,
  countryCode,
  onChange,
  disabled,
  glass = false,
}) {
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
  const helper = showError ? "Wrong phone number format" : glass ? undefined : PHONE_FORMAT_HINT;

  const emit = (nextIso, nextNational) => {
    const opt = COUNTRY_PHONE_OPTIONS.find((o) => o.iso === nextIso) || COUNTRY_PHONE_OPTIONS.find((o) => o.iso === "UA");
    const combined = combinePhone(opt.dial, nextNational);
    onChange({ phoneNumber: combined, countryCode: opt.iso });
  };

  const fieldSx = glass ? glassFieldSx : undefined;
  const autoSx = glass ? glassAutocompleteSx : undefined;

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <Autocomplete
        size="small"
        sx={{ width: glass ? 148 : 200, flexShrink: 0, ...autoSx }}
        disabled={disabled}
        options={COUNTRY_PHONE_OPTIONS}
        getOptionLabel={optionLabel}
        isOptionEqualToValue={(a, b) => a.iso === b.iso}
        value={selected}
        onChange={(_, opt) => {
          if (!opt) return;
          emit(opt.iso, national);
        }}
        ListboxProps={{ style: { maxHeight: 320 } }}
        renderInput={(params) => (
          <TextField
            {...params}
            hiddenLabel={glass}
            label={glass ? undefined : "Country"}
            placeholder={glass ? "Country" : undefined}
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
        hiddenLabel={glass}
        label={glass ? undefined : label}
        placeholder={glass ? "Phone number" : undefined}
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
