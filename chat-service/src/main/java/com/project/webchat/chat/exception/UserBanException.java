package com.project.webchat.chat.exception;

import lombok.Getter;

@Getter
public class UserBanException extends RuntimeException {

    public static final String CODE = "USER_BANNED";

    private final String displayName;

    public UserBanException(String displayName) {
        super(buildMessage(displayName));
        this.displayName = displayName != null && !displayName.isBlank() ? displayName.trim() : "this user";
    }

    private static String buildMessage(String displayName) {
        String name = displayName != null && !displayName.isBlank() ? displayName.trim() : "this user";
        return "You have banned " + name + ". Unban them from Settings to restore your private chat.";
    }
}
