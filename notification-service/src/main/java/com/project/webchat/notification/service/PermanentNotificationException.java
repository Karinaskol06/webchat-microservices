package com.project.webchat.notification.service;

public class PermanentNotificationException extends RuntimeException {

    public PermanentNotificationException(String message) {
        super(message);
    }

    public PermanentNotificationException(String message, Throwable cause) {
        super(message, cause);
    }
}
