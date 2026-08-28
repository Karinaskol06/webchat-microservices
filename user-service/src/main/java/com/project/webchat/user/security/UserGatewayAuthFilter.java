package com.project.webchat.user.security;

import com.project.webchat.shared.security.GatewayAuthHeaders;
import com.project.webchat.shared.security.InternalServiceAuthentication;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Trusts identity only when stamped with a valid {@link GatewayAuthHeaders#GATEWAY_AUTH} token
 * (API gateway or inter-service Feign). Optional Bearer JWT is a fallback for local tooling.
 */
@Component
@Slf4j
public class UserGatewayAuthFilter extends OncePerRequestFilter {

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

    private boolean authenticateFromGatewayHeaders(HttpServletRequest request) {
        // If secret doesn't match, this path fails (token is forged)
        String gatewayHeader = request.getHeader(GatewayAuthHeaders.GATEWAY_AUTH);
        if (!gatewayAuthToken.equals(gatewayHeader)) {
            return false;
        }

        // For internal service calls
        String userIdHeader = request.getHeader(GatewayAuthHeaders.USER_ID);
        if (userIdHeader == null || userIdHeader.isBlank()) {
            SecurityContextHolder.getContext().setAuthentication(InternalServiceAuthentication.create());
            log.debug("Authenticated internal service call via gateway token");
            return true;
        }

        // Real user auth after checks
        try {
            Long userId = Long.parseLong(userIdHeader.trim());
            String username = request.getHeader(GatewayAuthHeaders.USERNAME);

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                            userId,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_USER")));
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
            log.debug("Authenticated user {} via gateway headers", userId);
            return true;
        } catch (NumberFormatException e) {
            log.warn("Ignored invalid gateway X-User-Id header: {}", userIdHeader);
            return false;
        }
    }

    // Fallback (validating signature and claims here, instead of gateway)
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

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                            userId,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_USER")));
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
            log.debug("Authenticated user {} via Bearer token", userId);
        } catch (Exception e) {
            log.warn("JWT validation failed: {}", e.getMessage());
        }
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
