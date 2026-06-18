package com.project.webchat.shared.dto;

/**
 * Sentinel values for soft-deleted accounts still referenced by chats and messages.
 */
public final class DeletedAccountProfile {

    public static final String DISPLAY_LABEL = "Deleted account";

    private DeletedAccountProfile() {
    }

    public static String usernameForId(Long userId) {
        return "deleted_" + userId;
    }

    public static String emailForId(Long userId) {
        return "deleted_" + userId + "@deleted.invalid";
    }
}
