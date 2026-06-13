package com.project.webchat.chat.entity;

public enum MessageType {
    TEXT, ATTACHMENT, MIXED,
    /** Interactive checklist stored as JSON in {@code content}. */
    TODO,
    /** Sticky note card; JSON may include position for personal-space layout. */
    STICKY_NOTE,
    /** Notion-style callout block. */
    CALLOUT,
    /** Group/channel poll or quiz; JSON in {@code content}. */
    POLL
}
