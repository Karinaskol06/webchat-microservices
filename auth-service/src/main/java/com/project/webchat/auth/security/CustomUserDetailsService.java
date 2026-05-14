package com.project.webchat.auth.security;

import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.shared.dto.UserDTO;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomUserDetailsService implements UserDetailsService {

    private final UserServiceClient userServiceClient;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        log.debug("Loading user by username: {}", username);

        try {
            //call user-service to get user info
            ResponseEntity<UserCredentialsResponse> response =
                    userServiceClient.getUserWithPasswordByUsername(username);
            UserCredentialsResponse userInfo = response.getBody();

            if (userInfo == null) {
                log.error("User not found with username: {}", username);
                throw new UsernameNotFoundException("User not found: " + username);
            }

            log.debug("User loaded successfully: {}, has password: {}",
                    username, userInfo.getPassword() != null ? "YES" : "NO");

            return CustomUserDetails.builder()
                    .id(userInfo.getId())
                    .username(userInfo.getUsername())
                    .email(userInfo.getEmail())
                    .passwordHash(userInfo.getPassword())
                    .active(true)
                    .build();

        } catch (ResponseStatusException e) {
            HttpStatusCode status = e.getStatusCode();
            if (status.equals(HttpStatus.NOT_FOUND)) {
                log.warn("User not found via user-service: {}", username);
                throw new UsernameNotFoundException("User not found: " + username);
            }
            if (status.is5xxServerError() || status.equals(HttpStatus.BAD_GATEWAY)
                    || status.equals(HttpStatus.SERVICE_UNAVAILABLE) || status.equals(HttpStatus.GATEWAY_TIMEOUT)) {
                log.error("User service error loading user: {}, status: {}", username, status, e);
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Authentication service temporarily unavailable", e);
            }
            log.error("User service client error loading user: {}, status: {}", username, status, e);
            throw e;
        } catch (FeignException.NotFound e) {
            log.warn("User not found via Feign: {}", username);
            throw new UsernameNotFoundException("User not found: " + username);
        } catch (FeignException e) {
            log.error("Feign error loading user: {}, status: {}", username, e.status(), e);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Authentication service temporarily unavailable", e);
        }
    }
}