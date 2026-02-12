package com.project.webchat.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ChatParticipantDTO {
    private Long id;
    private String username;
    private boolean online;
}
