package com.project.webchat.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ToggleReactionRequest {

    @NotBlank(message = "Emoji is required")
    @Size(max = 32, message = "Emoji is too long")
    private String emoji;
}
