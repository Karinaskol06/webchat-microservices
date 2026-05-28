package com.project.webchat.user.dto;

import com.project.webchat.shared.dto.ContactRequestState;
import com.project.webchat.shared.dto.UserDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IncomingContactRequestDTO {
    private Long id;
    private ContactRequestState state;
    private LocalDateTime createdAt;
    private LocalDateTime nextEligibleAt;
    private UserDTO fromUser;
}
