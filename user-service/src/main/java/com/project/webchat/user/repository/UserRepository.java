package com.project.webchat.user.repository;

import com.project.webchat.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    Page<User> findByUsernameStartingWithIgnoreCase(String usernamePrefix, Pageable pageable);

    Page<User> findByIdNotAndUsernameStartingWithIgnoreCase(Long excludedUserId, String usernamePrefix, Pageable pageable);

    Page<User> findByUsernameStartingWithIgnoreCaseAndIsActiveTrue(String usernamePrefix, Pageable pageable);

    Page<User> findByIdNotAndUsernameStartingWithIgnoreCaseAndIsActiveTrue(
            Long excludedUserId, String usernamePrefix, Pageable pageable);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE User u SET u.lastSeenAt = :seenAt WHERE u.id = :userId "
            + "AND (u.lastSeenAt IS NULL OR u.lastSeenAt < :seenAt)")
    int updateLastSeenIfNewer(@Param("userId") Long userId, @Param("seenAt") LocalDateTime seenAt);
}
