package com.project.webchat.chat.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import com.project.webchat.shared.security.JwtHs256Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        String path = request.getRequestURI();

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                String token = authHeader.substring(7).trim();

                var signingKey = JwtHs256Keys.fromConfiguredSecret(secretKey);

                Claims claims = Jwts.parser()
                        .verifyWith(signingKey)
                        .build()
                        .parseSignedClaims(token)
                        .getPayload();

                Long userId = resolveUserId(claims);
                String username = claims.getSubject();
                String email = claims.get("email", String.class);

                if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {

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

                    log.debug("Authenticated user {} in chat-service", userId);
                }
            } catch (Exception e) {
                log.error("JWT validation failed: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }

    private static Long resolveUserId(Claims claims) {
        Object raw = claims.get("userId");
        if (raw == null) {
            // Fallback: if older tokens stored id in subject
            try {
                return Long.parseLong(claims.getSubject());
            } catch (Exception ignored) {
                return null;
            }
        }

        if (raw instanceof Number n) {
            return n.longValue();
        }

        try {
            return Long.parseLong(raw.toString());
        } catch (Exception ignored) {
            return null;
        }
    }

}
