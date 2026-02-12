package com.project.webchat.chat.security;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

@Component
public class JwtToCustomUser implements Converter<Jwt, CustomUserDetails> {

    @Override
    public CustomUserDetails convert(Jwt jwt) {
        Long userId;

        if (jwt.getClaim("userId") != null) {
            userId = jwt.getClaim("userId");
        } else {
            userId = Long.parseLong(jwt.getSubject());
        }

        String username = jwt.getClaim("username");

        return CustomUserDetails.builder()
                .id(userId)
                .username(username)
                .email(jwt.getClaim("email"))
                .firstName(jwt.getClaim("firstName"))
                .lastName(jwt.getClaim("lastName"))
                .build();
    }
}
