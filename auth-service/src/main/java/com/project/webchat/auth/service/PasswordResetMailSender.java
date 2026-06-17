package com.project.webchat.auth.service;

import com.project.webchat.auth.config.MailProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Component
@Slf4j
@RequiredArgsConstructor
public class PasswordResetMailSender implements PasswordResetNotifier {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final MailProperties mailProperties;

    @Override
    public void sendPasswordResetEmail(String recipientEmail, String resetLink) {
        if (!mailProperties.isEnabled()) {
            log.info("Password reset link for {} (mail disabled): {}", recipientEmail, resetLink);
            return;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.error("Mail is enabled but JavaMailSender is not configured");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Password reset is temporarily unavailable");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailProperties.getFrom());
        message.setTo(recipientEmail);
        message.setSubject("Reset your WebChat password");
        message.setText("""
                You requested a password reset for your WebChat account.

                Open the link below to choose a new password (valid for a limited time):
                %s

                If you did not request this, you can ignore this email.
                """.formatted(resetLink));

        try {
            mailSender.send(message);
            log.info("Password reset email sent to {}", recipientEmail);
        } catch (MailException e) {
            log.error("Failed to send password reset email to {}", recipientEmail, e);
            throw e;
        }
    }
}
