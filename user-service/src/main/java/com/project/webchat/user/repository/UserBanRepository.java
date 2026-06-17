package com.project.webchat.user.repository;

import com.project.webchat.user.entity.UserBan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserBanRepository extends JpaRepository<UserBan, Long> {
    boolean existsByUserIdAndBannedUserId(Long userId, Long bannedUserId);

    Optional<UserBan> findByUserIdAndBannedUserId(Long userId, Long bannedUserId);

    List<UserBan> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<UserBan> findByBannedUserIdOrderByCreatedAtDesc(Long bannedUserId);

    void deleteByUserIdAndBannedUserId(Long userId, Long bannedUserId);
}
