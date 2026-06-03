package com.project.webchat.chat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
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
    private static final String AFK_CHAT_PREFIX = "AFK:";
    private static final String LAST_SEEN_PREFIX = "last_seen:";
    private static final String USER_INFO_PREFIX = "user_info:";
    private static final String CHAT_PARTICIPANTS_PREFIX = "chat_participants:";
    private static final Duration USER_CACHE_TIMEOUT = Duration.ofMinutes(30);
    private static final Duration CHAT_PARTICIPANTS_CACHE_TIMEOUT = Duration.ofMinutes(5);
    private static final Duration ONLINE_TIMEOUT = Duration.ofMinutes(1);

    //mark user online
    public void markUserOnline(Long userId, String chatId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        String lastSeenKey = LAST_SEEN_PREFIX + userId;

        // if user switches chats, remove from previous chat set
        String previousState = redisTemplate.opsForValue().get(userKey);
        String previousChat = extractChatId(previousState);
        if (previousChat != null && !previousChat.equals(chatId)) {
            redisTemplate.opsForSet().remove(CHAT_ONLINE_USERS_PREFIX + previousChat, userId.toString());
        }

        //to automatically disconnect user after 1 min
        redisTemplate.opsForValue().set(userKey, chatId, ONLINE_TIMEOUT);
        redisTemplate.opsForValue().set(lastSeenKey, String.valueOf(System.currentTimeMillis()));

        //add user to online users
        redisTemplate.opsForSet().add(ONLINE_USERS_KEY, userId.toString());
        redisTemplate.opsForSet().add(CHAT_ONLINE_USERS_PREFIX + chatId, userId.toString());

        log.debug("User {} marked online in chat {}", userId, chatId);
    }

    public void markUserAfk(Long userId, String chatId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        String stateValue = AFK_CHAT_PREFIX + chatId;
        String currentState = redisTemplate.opsForValue().get(userKey);
        String currentChat = extractChatId(currentState);

        redisTemplate.opsForValue().set(userKey, stateValue, ONLINE_TIMEOUT);
        redisTemplate.opsForSet().add(ONLINE_USERS_KEY, userId.toString());
        redisTemplate.opsForSet().remove(CHAT_ONLINE_USERS_PREFIX + chatId, userId.toString());
        if (currentChat != null && !currentChat.equals(chatId)) {
            redisTemplate.opsForSet().remove(CHAT_ONLINE_USERS_PREFIX + currentChat, userId.toString());
        }

        String lastSeenKey = LAST_SEEN_PREFIX + userId;
        redisTemplate.opsForValue().set(lastSeenKey, String.valueOf(System.currentTimeMillis()));
        log.debug("User {} marked AFK for chat {}", userId, chatId);
    }

    //mark user offline
    public void markUserOffline(Long userId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        String currentChat = extractChatId(redisTemplate.opsForValue().get(userKey));

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

    // cache user info (set of users with TTL 30 mins)
    public void cacheUserInfo(UserInfoDTO userInfo) {
        try {
            String key = USER_INFO_PREFIX + userInfo.getId();
            String value = objectMapper.writeValueAsString(userInfo);
            redisTemplate.opsForValue().set(key, value, USER_CACHE_TIMEOUT);
        } catch (Exception e) {
            log.error("Failed to cache user info: {}", e.getMessage());
        }
    }

    // retrieve user info from cache
    public UserInfoDTO getCachedUserInfo(Long userId) {
        try {
            // make sure user key exists
            String key = USER_INFO_PREFIX + userId;
            String value = redisTemplate.opsForValue().get(key);
            if (value != null) {
                // deserialize user info
                return objectMapper.readValue(value, UserInfoDTO.class);
            }
        } catch (Exception e) {
            log.error("Failed to cache user info: {}", e.getMessage());
        }
        return null;
    }

    public void cacheChatParticipants(String chatId, Set<Long> participantIds) {
        if (chatId == null || chatId.isBlank() || participantIds == null || participantIds.isEmpty()) {
            return;
        }
        try {
            // create key for chat participants
            String key = CHAT_PARTICIPANTS_PREFIX + chatId;
            // serialize participant ids
            String value = objectMapper.writeValueAsString(participantIds);
            // cache participants with TTL 5 mins
            redisTemplate.opsForValue().set(key, value, CHAT_PARTICIPANTS_CACHE_TIMEOUT);
        } catch (Exception e) {
            log.error("Failed to cache chat participants for {}: {}", chatId, e.getMessage());
        }
    }

    // retrieve cached chat participants
    public List<Long> getCachedChatParticipants(String chatId) {
        if (chatId == null || chatId.isBlank()) {
            return List.of();
        }
        try {
            // create key for chat participants
            String key = CHAT_PARTICIPANTS_PREFIX + chatId;
            // get cached participants
            String value = redisTemplate.opsForValue().get(key);
            if (value != null) {
                // deserialize participant ids
                return new ArrayList<>(objectMapper.readValue(
                        value,
                        objectMapper.getTypeFactory().constructCollectionType(Set.class, Long.class)
                ));
            }
        } catch (JsonProcessingException e) {
            log.warn("Failed to deserialize participants cache for {}: {}", chatId, e.getMessage());
        } catch (Exception e) {
            log.error("Failed to fetch participants cache for {}: {}", chatId, e.getMessage());
        }
        return List.of();
    }

    // evict cached chat participants
    public void evictChatParticipants(String chatId) {
        if (chatId == null || chatId.isBlank()) {
            return;
        }
        redisTemplate.delete(CHAT_PARTICIPANTS_PREFIX + chatId);
    }

    //get the chat user is now in
    public String getCurrentChat(Long userId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        //retrieves value for given key
        return extractChatId(redisTemplate.opsForValue().get(userKey));
    }

    public boolean isUserAfk(Long userId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        String state = redisTemplate.opsForValue().get(userKey);
        return state != null && state.startsWith(AFK_CHAT_PREFIX);
    }

    //to keep user online while active
    public void heartbeat(Long userId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        String chatId = extractChatId(redisTemplate.opsForValue().get(userKey));

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

    private String extractChatId(String stateValue) {
        if (stateValue == null || stateValue.isBlank()) {
            return null;
        }
        if (stateValue.startsWith(AFK_CHAT_PREFIX)) {
            return stateValue.substring(AFK_CHAT_PREFIX.length());
        }
        return stateValue;
    }

}
