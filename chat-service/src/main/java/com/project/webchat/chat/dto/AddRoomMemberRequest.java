package com.project.webchat.chat.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AddRoomMemberRequest {

    @NotNull(message = "User id is required")
    private Long userId;
}
