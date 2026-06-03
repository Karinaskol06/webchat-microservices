package com.project.webchat.user.dto;

import com.project.webchat.shared.dto.UserDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UpdateAccountResultDTO {
    private UserDTO user;
    private boolean usernameChanged;
    private String message;
}
