package com.project.webchat.notification.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "notification_delivery",
        uniqueConstraints = {
                //to avoid duplicate push notifications if retrying
                @UniqueConstraint(
                        name = "uk_notification_delivery_event_recipient_channel",
                        columnNames = {"event_id", "recipient_user_id", "channel"}
                )
        },
        indexes = {
                @Index(name = "idx_notification_delivery_recipient", columnList = "recipient_user_id"),
                @Index(name = "idx_notification_delivery_event", columnList = "event_id")
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDelivery {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "recipient_user_id", nullable = false)
    private Long recipientUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DeliveryChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DeliveryStatus status;

    @Column(name = "failure_reason", length = 1024)
    private String failureReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
