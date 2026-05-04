package com.project.webchat.shared.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactRequestCreateDTO {
    @NotNull
    private Long fromUserId;

    @NotNull
    private Long toUserId;
}
