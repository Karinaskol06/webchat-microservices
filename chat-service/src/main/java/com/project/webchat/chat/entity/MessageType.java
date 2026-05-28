package com.project.webchat.chat.entity;

public enum MessageType {
    TEXT, ATTACHMENT, MIXED,
    /** Interactive checklist stored as JSON in {@code content}. */
    TODO,
    /** Sticky note card; JSON may include position for personal-space layout. */
    STICKY_NOTE,
    /** Notion-style callout block. */
    CALLOUT,
    /** Permanent horizontal divider in the message stream. */
    DIVIDER
}
