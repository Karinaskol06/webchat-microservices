package com.project.webchat.auth.security;

import com.project.webchat.auth.entity.AuthUser;
import com.project.webchat.auth.repository.AuthUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@RequiredArgsConstructor
@Service
public class CustomUserDetailsService implements UserDetailsService {

   private final AuthUserRepository authUserRepository;

   @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
       AuthUser authUser = authUserRepository.findByUsername(username)
               .orElseThrow(() -> new UsernameNotFoundException(
                       "User not found with username or email: " + username));

       return new CustomUserDetails(authUser);
   }
}
