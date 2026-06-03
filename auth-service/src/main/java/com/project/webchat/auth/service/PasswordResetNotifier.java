package com.project.webchat.auth.service;

public interface PasswordResetNotifier {

    void sendPasswordResetEmail(String recipientEmail, String resetLink);
}
