package com.project.webchat.chat.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateRoomPhotoRequest {

    @NotBlank(message = "Room photo is required")
    private String groupPhoto;
}
