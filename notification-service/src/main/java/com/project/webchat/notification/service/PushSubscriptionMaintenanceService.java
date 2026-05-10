package com.project.webchat.notification.service;

import com.project.webchat.notification.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Side-channel service for housekeeping operations on push subscriptions.
 * <p>
 * Methods run in {@link Propagation#REQUIRES_NEW} transactions so cleanup
 * (e.g. removing endpoints rejected by the push provider) commits immediately
 * and is NOT rolled back together with the surrounding Kafka consumer
 * transaction if a later subscription in the same delivery loop fails.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PushSubscriptionMaintenanceService {

    private final PushSubscriptionRepository pushSubscriptionRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteSubscriptionInNewTransaction(Long subscriptionId, String reason) {
        try {
            pushSubscriptionRepository.deleteById(subscriptionId);
            log.info("Removed push subscription subscriptionId={} reason={}", subscriptionId, reason);
        } catch (Exception ex) {
            // Swallow — a missing row is fine, and we never want maintenance
            // to bubble up and break the surrounding push delivery loop.
            log.warn("Failed to remove push subscription subscriptionId={} reason={} message={}",
                    subscriptionId, reason, ex.getMessage());
        }
    }
}
