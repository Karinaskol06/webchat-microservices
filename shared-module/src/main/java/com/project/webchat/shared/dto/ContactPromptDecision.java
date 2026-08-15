package com.project.webchat.shared.dto;

/**
 * Per-user decision on a contact prompt (independent of the other person).
 */
public enum ContactPromptDecision {
    /** Prompt still shown to this user */
    PENDING,
    /** User added the other to their contacts and closed the prompt */
    ADDED,
    /** User dismissed/declined the prompt without adding */
    DISMISSED
}
