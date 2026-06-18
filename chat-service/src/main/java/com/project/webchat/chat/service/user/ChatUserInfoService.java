package com.project.webchat.chat.service.user;

import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatUserInfoService {

    private final RedisService redisService;
    private final UserServiceClient userServiceClient;

    public UserInfoDTO getUserInfo(Long userId) {
        return getUserInfo(userId, true);
    }

    /**
     * @param useCache when false, always loads from user-service (for chat list previews).
     */
    public UserInfoDTO getUserInfo(Long userId, boolean useCache) {
        if (useCache) {
            UserInfoDTO cached = redisService.getCachedUserInfo(userId);
            if (cached != null) {
                if (cached.isDeleted()) {
                    return DeletedUserInfoFactory.build(userId);
                }
                cached.setOnline(redisService.isUserOnline(userId));
                return cached;
            }
        }

        try {
            ResponseEntity<UserDTO> response = userServiceClient.getUserById(userId);
            UserDTO userData = response.getBody();

            if (userData != null) {
                if (userData.isDeleted() || !userData.isActive()) {
                    UserInfoDTO deleted = DeletedUserInfoFactory.build(userId);
                    if (useCache) {
                        redisService.cacheUserInfo(deleted);
                    }
                    return deleted;
                }

                UserInfoDTO userInfo = UserInfoDTO.builder()
                        .id(userData.getId())
                        .username(userData.getUsername())
                        .firstName(userData.getFirstName())
                        .lastName(userData.getLastName())
                        .profilePicture(userData.getProfilePicture())
                        .online(redisService.isUserOnline(userId))
                        .deleted(false)
                        .build();

                if (useCache) {
                    redisService.cacheUserInfo(userInfo);
                }
                return userInfo;
            }
        } catch (Exception e) {
            log.error("Failed to fetch user {}: {}", userId, e.getMessage());
        }

        return DeletedUserInfoFactory.build(userId);
    }

    public Map<Long, UserInfoDTO> getUserInfoBatch(Set<Long> userIds) {
        return getUserInfoBatch(userIds, true);
    }

    public Map<Long, UserInfoDTO> getUserInfoBatch(Set<Long> userIds, boolean useCache) {
        return userIds.stream()
                .collect(Collectors.toMap(
                        id -> id,
                        id -> getUserInfo(id, useCache),
                        (existing, replacement) -> existing
                ));
    }
}
