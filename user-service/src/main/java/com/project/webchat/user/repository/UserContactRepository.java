package com.project.webchat.user.repository;

import com.project.webchat.user.entity.UserContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserContactRepository extends JpaRepository<UserContact, Long> {
    boolean existsByUserIdAndContactUserId(Long userId, Long contactUserId);
    List<UserContact> findByUserIdOrderByIdDesc(Long userId);

    @Modifying
    @Query("DELETE FROM UserContact c WHERE c.userId = :userId OR c.contactUserId = :userId")
    void deleteByUserIdOrContactUserId(@Param("userId") Long userId);
}
