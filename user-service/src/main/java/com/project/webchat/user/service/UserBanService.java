package com.project.webchat.user.service;

import com.project.webchat.shared.dto.UserBanStatusDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.user.entity.UserBan;
import com.project.webchat.user.repository.UserBanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class UserBanService {

    private final UserBanRepository userBanRepository;
    private final UserService userService;

    public void banUser(Long userId, Long targetUserId) {
        validatePair(userId, targetUserId);
        if (userBanRepository.existsByUserIdAndBannedUserId(userId, targetUserId)) {
            return;
        }
        userBanRepository.save(UserBan.builder()
                .userId(userId)
                .bannedUserId(targetUserId)
                .build());
    }

    public void unbanUser(Long userId, Long targetUserId) {
        validatePair(userId, targetUserId);
        userBanRepository.deleteByUserIdAndBannedUserId(userId, targetUserId);
    }

    @Transactional(readOnly = true)
    public UserBanStatusDTO getBanStatus(Long userId, Long targetUserId) {
        if (userId == null || targetUserId == null || userId.equals(targetUserId)) {
            return UserBanStatusDTO.builder().banned(false).build();
        }
        return UserBanStatusDTO.builder()
                .banned(userBanRepository.existsByUserIdAndBannedUserId(userId, targetUserId))
                .build();
    }

    @Transactional(readOnly = true)
    public List<UserDTO> listBannedUsers(Long userId) {
        return userBanRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(UserBan::getBannedUserId)
                .distinct()
                .map(userService::getUserDTOById)
                .sorted(Comparator.comparing(this::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Long> listBannedUserIds(Long userId) {
        return userBanRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(UserBan::getBannedUserId)
                .distinct()
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Long> listBanningUserIds(Long userId) {
        return userBanRepository.findByBannedUserIdOrderByCreatedAtDesc(userId).stream()
                .map(UserBan::getUserId)
                .distinct()
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean hasBanned(Long userId, Long targetUserId) {
        if (userId == null || targetUserId == null || userId.equals(targetUserId)) {
            return false;
        }
        return userBanRepository.existsByUserIdAndBannedUserId(userId, targetUserId);
    }

    private void validatePair(Long userId, Long targetUserId) {
        if (userId == null || targetUserId == null) {
            throw new IllegalArgumentException("User id is required.");
        }
        if (userId.equals(targetUserId)) {
            throw new IllegalArgumentException("You cannot ban yourself.");
        }
        userService.getUserDTOById(targetUserId);
    }

    private String displayName(UserDTO user) {
        if (user == null) {
            return "";
        }
        String full = ((user.getFirstName() != null ? user.getFirstName() : "")
                + " "
                + (user.getLastName() != null ? user.getLastName() : "")).trim();
        if (!full.isBlank()) {
            return full;
        }
        return user.getUsername() != null ? user.getUsername() : "";
    }
}
