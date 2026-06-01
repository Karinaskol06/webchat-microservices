package com.project.webchat.shared.validation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InternationalPhoneValidatorTest {

    private InternationalPhoneValidator validator;

    @BeforeEach
    void setUp() {
        validator = new InternationalPhoneValidator();
    }

    @Test
    void isValid_allowsNullOrBlank() {
        assertThat(validator.isValid(null, null)).isTrue();
        assertThat(validator.isValid("  ", null)).isTrue();
    }

    @Test
    void isValid_acceptsE164Phone() {
        assertThat(validator.isValid("+48123456789", null)).isTrue();
    }

    @Test
    void isValid_rejectsMissingPlusOrInvalidLength() {
        assertThat(validator.isValid("48123456789", null)).isFalse();
        assertThat(validator.isValid("+123", null)).isFalse();
        assertThat(validator.isValid("+1234567890123456", null)).isFalse();
    }

    @Test
    void isValid_rejectsLeadingZeroCountryDigit() {
        assertThat(validator.isValid("+0123456789", null)).isFalse();
    }

    @Test
    void isValid_rejectsNonDigits() {
        assertThat(validator.isValid("+48abc56789", null)).isFalse();
    }
}
