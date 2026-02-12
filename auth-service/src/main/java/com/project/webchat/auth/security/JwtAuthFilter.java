package com.project.webchat.auth.security;

import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.shared.dto.UserDTO;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
                                    throws ServletException, IOException {

        String path = request.getServletPath();

        //skip auth for public endpoints
        if (path.startsWith("/api/auth/") ||
                path.startsWith("/auth/") ||
                path.startsWith("/actuator/") ||
                path.startsWith("/error")) {
            filterChain.doFilter(request, response);
            return;
        }

        //get token from header
        String authHeader = request.getHeader("Authorization");

        //if no token - continue (and get 401)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            //extract token
            String jwt = authHeader.substring(7);
            String username = jwtService.extractUsername(jwt);

            //validate and set authentication
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                if (jwtService.validateToken(jwt)) {
                    Long userId = jwtService.extractUserId(jwt);
                    String email = jwtService.extractClaim(jwt, claims -> claims.get("email", String.class));

                    //create user details from token claims
                    CustomUserDetails userDetails = CustomUserDetails.builder()
                            .id(userId)
                            .username(username)
                            .email(email)
                            .build();

                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );

                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(authToken);

                    log.debug("Authenticated user: {}", username);
                }
            }
        } catch (Exception e) {
            logger.error("Cannot set user authentication: {}");
        }

        filterChain.doFilter(request, response);
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");
        if (StringUtils.hasText(headerAuth) && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }
        return null;
    }
}
