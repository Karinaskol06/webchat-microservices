package com.project.webchat.chat.service;

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

    //redis set for storing all online users
    private static final String ONLINE_USERS_KEY = "online_users";

    //which specific chat user is viewing (naming convention)
    private static final String USER_CHAT_KEY_PREFIX = "user_chat:";
    private static final String LAST_SEEN_PREFIX = "last_seen:";
    private static final Duration ONLINE_TIMEOUT = Duration.ofMinutes(1);

    //mark user online
    public void markUserOnline(Long userId, String chatId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;
        String lastSeenKey = LAST_SEEN_PREFIX + userId;

        //to automatically disconnect user after 3 mins
        redisTemplate.opsForValue().set(userKey, chatId, ONLINE_TIMEOUT);
        redisTemplate.opsForValue().set(lastSeenKey, String.valueOf(System.currentTimeMillis()));

        //add user to online users
        redisTemplate.opsForSet().add(ONLINE_USERS_KEY, userId.toString());

        log.debug("User {} marked online in chat {}", userId, chatId);
    }

    //mark user offline
    public void markUserOffline(Long userId) {
        String userKey = USER_CHAT_KEY_PREFIX + userId;

        //deletes user's chat tracking key
        redisTemplate.delete(userKey);

        //removes user from online users set
        redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, userId.toString());

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

    //get all online users
    public Set<String> getOnlineUsers() {
        //gets all redis members
        Set<String> all = redisTemplate.opsForSet().members(ONLINE_USERS_KEY);
        Set<String> reallyOnline = new HashSet<>();

        for (String userId : all) {
            if (isUserOnline(Long.parseLong(userId))) {
                reallyOnline.add(userId);
            } else {
                redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, userId);
            }
        }
        return reallyOnline;
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
