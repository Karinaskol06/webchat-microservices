package com.project.webchat.chat.dto;

public enum AdminAction {
    PROMOTE,
    DEMOTE,
    /** CHANNEL: allow a member to post messages */
    GRANT_POST,
    /** CHANNEL: remove posting permission from a poster */
    REVOKE_POST
}
