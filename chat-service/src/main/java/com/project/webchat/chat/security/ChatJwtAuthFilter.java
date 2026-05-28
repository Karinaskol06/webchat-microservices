package com.project.webchat.chat.security;

import com.project.webchat.shared.security.GatewayAuthHeaders;
import com.project.webchat.shared.security.JwtHs256Keys;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Slf4j
public class ChatJwtAuthFilter extends OncePerRequestFilter {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${gateway.internal-auth-token:local-gateway-token}")
    private String gatewayAuthToken;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            if (!authenticateFromGatewayHeaders(request)) {
                authenticateFromBearerToken(request);
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Trust identity stamped by API gateway (multipart uploads keep this even when Bearer re-parse fails).
     */
    private boolean authenticateFromGatewayHeaders(HttpServletRequest request) {
        String gatewayHeader = request.getHeader(GatewayAuthHeaders.GATEWAY_AUTH);
        if (!gatewayAuthToken.equals(gatewayHeader)) {
            return false;
        }

        String userIdHeader = request.getHeader(GatewayAuthHeaders.USER_ID);
        if (userIdHeader == null || userIdHeader.isBlank()) {
            return false;
        }

        try {
            Long userId = Long.parseLong(userIdHeader.trim());
            String username = request.getHeader(GatewayAuthHeaders.USERNAME);
            if (username == null || username.isBlank()) {
                username = String.valueOf(userId);
            }

            setAuthentication(request, userId, username.trim(), null);
            log.debug("Authenticated user {} via gateway headers", userId);
            return true;
        } catch (NumberFormatException e) {
            log.warn("Ignored invalid gateway X-User-Id header: {}", userIdHeader);
            return false;
        }
    }

    private void authenticateFromBearerToken(HttpServletRequest request) {
        String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return;
        }

        try {
            String token = authHeader.substring(7).trim();
            if (token.isEmpty()) {
                return;
            }

            Claims claims = Jwts.parser()
                    .verifyWith(JwtHs256Keys.fromConfiguredSecret(secretKey))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Long userId = resolveUserId(claims);
            if (userId == null) {
                return;
            }

            String username = claims.getSubject();
            String email = claims.get("email", String.class);
            setAuthentication(request, userId, username, email);
            log.debug("Authenticated user {} via Bearer token", userId);
        } catch (Exception e) {
            log.warn("JWT validation failed: {}", e.getMessage());
        }
    }

    private void setAuthentication(
            HttpServletRequest request,
            Long userId,
            String username,
            String email) {

        CustomUserDetails userDetails = CustomUserDetails.builder()
                .id(userId)
                .username(username)
                .email(email)
                .build();

        UsernamePasswordAuthenticationToken authToken =
                new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities());
        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authToken);
    }

    private static Long resolveUserId(Claims claims) {
        Object raw = claims.get("userId");
        if (raw == null) {
            try {
                return Long.parseLong(claims.getSubject());
            } catch (Exception ignored) {
                return null;
            }
        }

        if (raw instanceof Number number) {
            return number.longValue();
        }

        try {
            return Long.parseLong(raw.toString());
        } catch (Exception ignored) {
            return null;
        }
    }

}
