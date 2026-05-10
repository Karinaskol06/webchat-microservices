package com.project.webchat.notification.repository;

import com.project.webchat.notification.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {
    List<PushSubscription> findByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    Optional<PushSubscription> findByUserIdAndEndpoint(Long userId, String endpoint);

    void deleteByEndpoint(String endpoint);

    void deleteByUserIdAndEndpoint(Long userId, String endpoint);
}
