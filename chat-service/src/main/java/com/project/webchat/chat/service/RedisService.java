package com.project.webchat.chat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashSet;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class RedisService {

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    //redis set for storing all online users
    private static final String ONLINE_USERS_KEY = "online_users";
    //redis set per chat for storing online users in that chat
    private static final String CHAT_ONLINE_USERS_PREFIX = "chat_online_users:";

    //which specific chat user is viewing (naming convention)
    private static final String USER_CHAT_KEY_PREFIX = "user_chat:";
    private static final String LAST_SEEN_PREFIX = "last_seen:";
    private static final String USER_INFO_PREFIX = "user_info:";
    private static final Duration USER_CACHE_TIMEOUT = Duration.ofMinutes(30);
    private static final Duration ONLINE_TIMEOUT = Duration.ofMinutes(1);

    //mark user online
    public void markUserOnline(Long userId, String chatId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        String lastSeenKey = LAST_SEEN_PREFIX + userId;

        // if user switches chats, remove from previous chat set
        String previousChat = redisTemplate.opsForValue().get(userKey);
        if (previousChat != null && !previousChat.equals(chatId)) {
            redisTemplate.opsForSet().remove(CHAT_ONLINE_USERS_PREFIX + previousChat, userId.toString());
        }

        //to automatically disconnect user after 3 mins
        redisTemplate.opsForValue().set(userKey, chatId, ONLINE_TIMEOUT);
        redisTemplate.opsForValue().set(lastSeenKey, String.valueOf(System.currentTimeMillis()));

        //add user to online users
        redisTemplate.opsForSet().add(ONLINE_USERS_KEY, userId.toString());
        redisTemplate.opsForSet().add(CHAT_ONLINE_USERS_PREFIX + chatId, userId.toString());

        log.debug("User {} marked online in chat {}", userId, chatId);
    }

    //mark user offline
    public void markUserOffline(Long userId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        String currentChat = redisTemplate.opsForValue().get(userKey);

        //deletes user's chat tracking key
        redisTemplate.delete(userKey);

        //removes user from online users set
        redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, userId.toString());
        if (currentChat != null) {
            redisTemplate.opsForSet().remove(CHAT_ONLINE_USERS_PREFIX + currentChat, userId.toString());
        }

        String lastSeenKey = LAST_SEEN_PREFIX + userId;
        redisTemplate.opsForValue().set(lastSeenKey, String.valueOf(System.currentTimeMillis()));

        log.debug("User {} marked offline", userId);
    }

    //update user presence in chat
    public void updatePresence(Long userId, String chatId) {
        if (isUserOnline(userId)) {
            heartbeat(userId);

            String currentChat = getCurrentChat(userId);
            if (currentChat == null || !currentChat.equals(chatId)) {
                markUserOnline(userId, chatId);
            }
        } else {
            markUserOnline(userId, chatId);
        }
    }

    // get online users who are currently viewing a specific chat
    public Set<Long> getOnlineUsersInChat(String chatId) {
        Set<String> members = redisTemplate.opsForSet().members(CHAT_ONLINE_USERS_PREFIX + chatId);
        if (members == null || members.isEmpty()) {
            return Set.of();
        }

        Set<Long> result = new HashSet<>();
        for (String userIdStr : members) {
            Long userId;
            try {
                userId = Long.parseLong(userIdStr);
            } catch (NumberFormatException e) {
                redisTemplate.opsForSet().remove(CHAT_ONLINE_USERS_PREFIX + chatId, userIdStr);
                continue;
            }

            String currentChat = getCurrentChat(userId);
            if (chatId.equals(currentChat) && isUserOnline(userId)) {
                result.add(userId);
            } else {
                redisTemplate.opsForSet().remove(CHAT_ONLINE_USERS_PREFIX + chatId, userIdStr);
            }
        }
        return result;
    }

    public Long getLastSeen(Long userId) {
        String lastSeenKey = LAST_SEEN_PREFIX + userId;
        String timestamp = redisTemplate.opsForValue().get(lastSeenKey);

        if (timestamp != null) {
            try {
                return Long.parseLong(timestamp);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    public void cacheUserInfo(UserInfoDTO userInfo) {
        try {
            String key = USER_INFO_PREFIX + userInfo.getId();
            String value = objectMapper.writeValueAsString(userInfo);
            redisTemplate.opsForValue().set(key, value, USER_CACHE_TIMEOUT);
        } catch (Exception e) {
            log.error("Failed to cache user info: {}", e.getMessage());
        }
    }

    public UserInfoDTO getCachedUserInfo(Long userId) {
        try {
            String key = USER_INFO_PREFIX + userId;
            String value = redisTemplate.opsForValue().get(key);
            if (value != null) {
                return objectMapper.readValue(value, UserInfoDTO.class);
            }
        } catch (Exception e) {
            log.error("Failed to cache user info: {}", e.getMessage());
        }
        return null;
    }

    //get the chat user is now in
    public String getCurrentChat(Long userId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        //retrieves value for given key
        return redisTemplate.opsForValue().get(userKey);
    }

    //to keep user online while active
    public void heartbeat(Long userId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        String chatId = redisTemplate.opsForValue().get(userKey);

        if (chatId != null) {
            //refresh the TTL
            redisTemplate.expire(userKey, ONLINE_TIMEOUT);

            String lastSeenKey = LAST_SEEN_PREFIX + userId;
            redisTemplate.opsForValue().set(lastSeenKey, String.valueOf(System.currentTimeMillis()));
        }
    }

    //check if user online
    public boolean isUserOnline(Long userId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        //checks if user key exists in redis
        return Boolean.TRUE.equals(redisTemplate.hasKey(userKey));
    }

}
