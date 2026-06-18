package com.project.webchat.user.repository;

import com.project.webchat.user.entity.ProfileImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProfileImageRepository extends JpaRepository<ProfileImage, Long> {
    Optional<ProfileImage> findByUserIdAndKind(Long userId, String kind);
    boolean existsByUserIdAndKind(Long userId, String kind);
    void deleteByUserIdAndKind(Long userId, String kind);

    void deleteByUserId(Long userId);
}
