package com.project.webchat.notification.repository;

import com.project.webchat.notification.entity.DeliveryChannel;
import com.project.webchat.notification.entity.NotificationDelivery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface NotificationDeliveryRepository extends JpaRepository<NotificationDelivery, Long> {
    Optional<NotificationDelivery> findByEventIdAndRecipientUserIdAndChannel(
            UUID eventId,
            Long recipientUserId,
            DeliveryChannel channel
    );
}
