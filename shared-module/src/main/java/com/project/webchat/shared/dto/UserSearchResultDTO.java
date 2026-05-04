package com.project.webchat.shared.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserSearchResultDTO {
    private Long id;
    private String username;
    private String firstName;
    private String lastName;
    private String displayName;
    private String avatar;
}
