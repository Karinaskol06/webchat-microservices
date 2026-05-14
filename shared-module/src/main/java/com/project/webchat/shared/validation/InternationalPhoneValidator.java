package com.project.webchat.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class InternationalPhoneValidator implements ConstraintValidator<InternationalPhone, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        String phone = value.trim();
        if (!phone.startsWith("+") || phone.length() < 2) {
            return false;
        }
        String rest = phone.substring(1);
        if (rest.isEmpty() || rest.length() > 15 || rest.length() < 7) {
            return false;
        }
        for (int i = 0; i < rest.length(); i++) {
            if (!Character.isDigit(rest.charAt(i))) {
                return false;
            }
        }
        char firstDigit = rest.charAt(0);
        return firstDigit >= '1' && firstDigit <= '9';
    }
}
