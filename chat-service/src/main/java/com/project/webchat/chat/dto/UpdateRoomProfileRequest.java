package com.project.webchat.chat.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateRoomProfileRequest {

    @Size(max = 100, message = "Name must be at most 100 characters")
    private String groupName;

    @Size(max = 2000, message = "Description must be at most 2000 characters")
    private String description;

    @Size(max = 750_000, message = "Room image is too large")
    private String groupPhoto;
}
