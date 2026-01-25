package com.project.webchat.auth.security;

import com.project.webchat.auth.entity.AuthUser;
import com.project.webchat.auth.repository.AuthUserRepository;
import com.project.webchat.shared.exceptions.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SecurityUtils {
    private final AuthUserRepository authUserRepository;

    public Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new UnauthorizedException("User not authenticated");
        }
        String username = auth.getName();

        AuthUser authUser = authUserRepository.findByUsername(username)
                .orElseThrow(() -> new UnauthorizedException("User not found"));
        return authUser.getUserServiceId();
    }
}
