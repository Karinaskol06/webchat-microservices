package com.project.webchat.user.repository;

import com.project.webchat.user.entity.UserContact;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserContactRepository extends JpaRepository<UserContact, Long> {
    boolean existsByUserIdAndContactUserId(Long userId, Long contactUserId);
}
