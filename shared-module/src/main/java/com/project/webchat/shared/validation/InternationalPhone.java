package com.project.webchat.shared.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * E.164-style international number: leading {@code +}, digits only after that, 7–15 digits total after {@code +},
 * first digit after {@code +} must be 1–9 (valid country code start).
 */
@Documented
@Constraint(validatedBy = InternationalPhoneValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface InternationalPhone {

    String message() default "Phone must start with + followed by digits only (7–15)";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
