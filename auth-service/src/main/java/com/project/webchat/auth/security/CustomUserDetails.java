package com.project.webchat.auth.security;

import com.project.webchat.auth.entity.AuthUser;
import com.project.webchat.shared.security.JwtUser;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

@Getter
public class CustomUserDetails extends JwtUser implements UserDetails {

    private final AuthUser authUser;

    public CustomUserDetails(AuthUser authUser) {
        this.authUser = authUser;
    }

    public Long getId() {
        return authUser.getId();
    }

    public Long getUserServiceId() {
        return authUser.getUserServiceId();
    }

    @Override
    public String getPassword() {
        return authUser.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return authUser.getUsername();
    }

    public String getEmail() {
        return authUser.getEmail();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of();
    }

    @Override
    public boolean isAccountNonExpired() {
        return authUser.isActive();
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return authUser.isActive();
    }
}
