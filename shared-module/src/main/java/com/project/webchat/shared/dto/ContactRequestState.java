package com.project.webchat.shared.dto;

public enum ContactRequestState {
    NONE,
    PENDING,
    ACCEPTED,
    /** Recipient declined; request will not be recreated on later messages */
    REJECTED
}
