package com.project.webchat.user.dto;

import com.project.webchat.shared.dto.ContactPromptDecision;
import com.project.webchat.shared.dto.ContactRequestState;
import com.project.webchat.user.entity.FriendRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactRequestDTO {
    private Long id;
    private Long fromUserId;
    private Long toUserId;
    private ContactRequestState state;
    private ContactPromptDecision fromUserDecision;
    private ContactPromptDecision toUserDecision;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime nextEligibleAt;

    public static ContactRequestDTO fromEntity(FriendRequest request) {
        if (request == null) {
            return null;
        }
        return ContactRequestDTO.builder()
                .id(request.getId())
                .fromUserId(request.getFromUserId())
                .toUserId(request.getToUserId())
                .state(request.getState())
                .fromUserDecision(request.getFromUserDecision())
                .toUserDecision(request.getToUserDecision())
                .createdAt(request.getCreatedAt())
                .updatedAt(request.getUpdatedAt())
                .nextEligibleAt(request.getNextEligibleAt())
                .build();
    }
}
