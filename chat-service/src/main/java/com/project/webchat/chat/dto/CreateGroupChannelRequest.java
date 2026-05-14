package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.RoomVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.HashSet;
import java.util.Set;

@Data
public class CreateGroupChannelRequest {

    @NotBlank(message = "Name is required")
    private String name;

    /** Optional image URL or a data URL (e.g. pasted JPEG); server rejects oversized payloads. */
    @Size(max = 750_000, message = "Room image is too large")
    private String groupPhoto;

    @Size(max = 2000, message = "Description must be at most 2000 characters")
    private String description;

    @NotNull(message = "Visibility is required")
    private RoomVisibility visibility;

    private Set<Long> memberIds = new HashSet<>();
}
