package com.project.webchat.chat.exception;

public class ForbiddenChatOperationException extends RuntimeException {

    public ForbiddenChatOperationException(String message) {
        super(message);
    }
}
