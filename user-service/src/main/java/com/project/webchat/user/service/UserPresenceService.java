package com.project.webchat.user.service;

import com.project.webchat.user.entity.User;
import com.project.webchat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
@Transactional
public class UserPresenceService {

    private final UserRepository userRepository;

    /** Overwrites last_seen_at only when the new timestamp is newer or missing. */
    public void updateLastSeen(Long userId, long epochMillis) {
        if (userId == null) {
            return;
        }
        LocalDateTime seenAt = LocalDateTime.ofInstant(
                Instant.ofEpochMilli(epochMillis), ZoneOffset.UTC);
        userRepository.updateLastSeenIfNewer(userId, seenAt);
    }

    @Transactional(readOnly = true)
    public Long getLastSeenEpochMillis(Long userId) {
        if (userId == null) {
            return null;
        }
        return userRepository.findById(userId)
                .map(User::getLastSeenAt)
                .map(seenAt -> seenAt.toInstant(ZoneOffset.UTC).toEpochMilli())
                .orElse(null);
    }
}
