package com.project.webchat.shared.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ContactPromptDescriptorDTO {
    private Long requestId;
    private Long fromUserId;
    private Long toUserId;
    private LocalDateTime nextEligibleAt;
}
