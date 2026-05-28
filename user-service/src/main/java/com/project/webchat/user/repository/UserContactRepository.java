package com.project.webchat.user.repository;

import com.project.webchat.user.entity.UserContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserContactRepository extends JpaRepository<UserContact, Long> {
    boolean existsByUserIdAndContactUserId(Long userId, Long contactUserId);
    List<UserContact> findByUserIdOrderByIdDesc(Long userId);
}
