package com.project.webchat.auth.security;

import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.shared.dto.UserDTO;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.NonNull;
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
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final UserServiceClient userServiceClient;

    public JwtAuthFilter(JwtService jwtService, UserDetailsService userDetailsService,
                         @Qualifier("com.project.webchat.auth.feign.UserServiceClient")
                         UserServiceClient userServiceClient) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.userServiceClient = userServiceClient;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
                                    throws ServletException, IOException {
        String path = request.getServletPath();
        if (path.startsWith("/api/auth/") ||
                path.startsWith("/auth/") ||
                path.startsWith("/actuator/") ||
                path.startsWith("/error")) {
            filterChain.doFilter(request, response);
        }

        final String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String jwt = authHeader.substring(7);
            String username = jwtService.extractUsername(jwt);

            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDTO userDTO = userServiceClient.getUserByUsername(username).getBody();

                if (userDTO != null && jwtService.isTokenValid(jwt,
                        userDetailsService.loadUserByUsername(userDTO.getUsername()))) {
                    CustomUserDetails userDetails = new CustomUserDetails(userDTO, "");

                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
            filterChain.doFilter(request, response);
        } catch (Exception e) {
            logger.error("Cannot set user authentication: {}");
            filterChain.doFilter(request, response);
        }
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");
        if (StringUtils.hasText(headerAuth) && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }
        return null;
    }
}
