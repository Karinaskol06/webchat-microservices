package com.project.webchat.chat.dto;

import lombok.Data;

@Data
public class EditMessageRequest {

    /** Empty or null clears the caption when the message still has attachments. */
    private String content;
}
