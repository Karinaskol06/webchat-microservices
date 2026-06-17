import React, { useEffect, useRef, useState } from "react";
import { IconButton, InputAdornment, Popover, TextField } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { StaticDatePicker } from "@mui/x-date-pickers/StaticDatePicker";
import { chatMenuPaperSx } from "../../theme/chatDesignTokens";
import {
  dateToBirthdayDisplay,
  formatBirthdayDigits,
  parseBirthdayDigits,
  toLocalDate,
} from "../../utils/localDate";

export default function BirthdayField({
  label = "Birthday",
  value,
  onChange,
  disabled = false,
  fullWidth = true,
}) {
  const [text, setText] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const isTypingRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isTypingRef.current) return;
    setText(dateToBirthdayDisplay(value));
    setInvalid(false);
  }, [value]);

  const handleTextChange = (event) => {
    isTypingRef.current = true;
    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = formatBirthdayDigits(digits);
    setText(formatted);
    setInvalid(false);

    if (digits.length === 0) {
      onChange?.(null);
      return;
    }

    if (digits.length === 8) {
      const parsed = parseBirthdayDigits(digits);
      if (parsed) {
        onChange?.(parsed);
        isTypingRef.current = false;
      } else {
        setInvalid(true);
      }
    }
  };

  const handleBlur = () => {
    isTypingRef.current = false;
    const digits = text.replace(/\D/g, "");
    if (digits.length === 0) {
      setText("");
      setInvalid(false);
      onChange?.(null);
      return;
    }
    if (digits.length === 8) {
      const parsed = parseBirthdayDigits(digits);
      if (parsed) {
        setText(dateToBirthdayDisplay(parsed));
        setInvalid(false);
        onChange?.(parsed);
        return;
      }
    }
    const restored = dateToBirthdayDisplay(value);
    setText(restored);
    setInvalid(Boolean(digits.length) && !restored);
  };

  const handleCalendarChange = (nextDate) => {
    const local = toLocalDate(nextDate);
    isTypingRef.current = false;
    setText(dateToBirthdayDisplay(local));
    setInvalid(false);
    onChange?.(local);
    setCalendarOpen(false);
  };

  return (
    <>
      <TextField
        fullWidth={fullWidth}
        label={label}
        placeholder="DD/MM/YYYY"
        value={text}
        disabled={disabled}
        inputRef={inputRef}
        onChange={handleTextChange}
        onBlur={handleBlur}
        error={invalid}
        helperText={invalid ? "Enter a valid date (DD/MM/YYYY)" : undefined}
        slotProps={{
          input: {
            inputMode: "numeric",
            endAdornment: disabled ? null : (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Open calendar"
                  edge="end"
                  size="small"
                  disabled={disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setCalendarOpen(true)}
                >
                  <CalendarMonthIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Popover
        open={calendarOpen}
        anchorEl={inputRef.current}
        onClose={() => setCalendarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: { sx: chatMenuPaperSx },
        }}
      >
        <StaticDatePicker
          displayStaticWrapperAs="desktop"
          value={toLocalDate(value)}
          onChange={handleCalendarChange}
          disabled={disabled}
          slotProps={{
            actionBar: { actions: [] },
          }}
        />
      </Popover>
    </>
  );
}
