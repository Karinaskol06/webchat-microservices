package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.RoomVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.HashSet;
import java.util.Set;

@Data
public class CreateGroupChannelRequest {

    @NotBlank(message = "Name is required")
    private String name;

    private String groupPhoto;

    @NotNull(message = "Visibility is required")
    private RoomVisibility visibility;

    private Set<Long> memberIds = new HashSet<>();
}
