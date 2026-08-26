package com.project.webchat.user.service;

import com.project.webchat.shared.dto.UserSearchResultDTO;
import com.project.webchat.user.entity.User;
import com.project.webchat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserSearchService {

    private final UserRepository userRepository;
    private final UserProfileService userProfileService;

    public Page<UserSearchResultDTO> searchUsers(String rawQuery, Long currentUserId, Pageable pageable) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < 2) {
            throw new IllegalArgumentException("Search query must be at least 2 characters long");
        }

        Page<User> searchPage = currentUserId == null
                ? userRepository.findByUsernameStartingWithIgnoreCaseAndIsActiveTrue(query, pageable)
                : userRepository.findByIdNotAndUsernameStartingWithIgnoreCaseAndIsActiveTrue(
                currentUserId, query, pageable);

        return searchPage.map(this::toSearchResultDTO);
    }

    private UserSearchResultDTO toSearchResultDTO(User user) {
        return UserSearchResultDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .displayName(userProfileService.resolveDisplayName(user))
                .avatar(userProfileService.resolveAvatarPictureUrl(user.getId()))
                .build();
    }
}
