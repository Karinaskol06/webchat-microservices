package com.project.webchat.chat.entity;

public enum ChatType {
    PRIVATE,
    GROUP,
    CHANNEL,
    /** Per-user workspace; single member, not shown in the main chat list. */
    PERSONAL_SPACE
}
