package com.project.webchat.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.regex.Pattern;

/**
 * Validates a practical subset of RFC 5322 with emphasis on a well-formed domain:
 * single {@code @}, local part length and character rules, domain labels and a letter-only TLD.
 */
public class ValidEmailDomainValidator implements ConstraintValidator<ValidEmailDomain, String> {

    private static final int MAX_LOCAL = 64;
    private static final int MAX_DOMAIN = 253;

    private static final Pattern DOMAIN_LABEL = Pattern.compile(
            "^(?=.{1,63}$)[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$");
    private static final Pattern TLD = Pattern.compile("^[A-Za-z]{2,63}$");
    private static final Pattern LOCAL_PART = Pattern.compile(
            "^[A-Za-z0-9](?:[A-Za-z0-9._+-]{0,61}[A-Za-z0-9])?$");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        String email = value.trim();
        int at = email.indexOf('@');
        if (at <= 0 || at != email.lastIndexOf('@')) {
            return false;
        }
        String local = email.substring(0, at);
        String domain = email.substring(at + 1);
        if (local.isEmpty() || local.length() > MAX_LOCAL || domain.isEmpty() || domain.length() > MAX_DOMAIN) {
            return false;
        }
        if (!LOCAL_PART.matcher(local).matches() || local.contains("..")) {
            return false;
        }
        if (!domain.contains(".")) {
            return false;
        }
        String[] labels = domain.split("\\.", -1);
        if (labels.length < 2) {
            return false;
        }
        for (int i = 0; i < labels.length - 1; i++) {
            if (!DOMAIN_LABEL.matcher(labels[i]).matches()) {
                return false;
            }
        }
        return TLD.matcher(labels[labels.length - 1]).matches();
    }
}
