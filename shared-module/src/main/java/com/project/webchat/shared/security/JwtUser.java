package com.project.webchat.shared.security;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class JwtUser {
    private Long id;
    private String username;
    private String email;
    private boolean active;
}
