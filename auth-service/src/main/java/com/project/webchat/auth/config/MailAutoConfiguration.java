package com.project.webchat.auth.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

/**
 * Only auto-configure SMTP when explicitly enabled. Keeps local/dev startup working
 * without mail credentials while still supporting production password-reset email.
 */
@Configuration
@ConditionalOnProperty(name = "app.mail.enabled", havingValue = "true")
@Import(MailSenderAutoConfiguration.class)
public class MailAutoConfiguration {
}
