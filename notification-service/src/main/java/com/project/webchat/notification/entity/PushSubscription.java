package com.project.webchat.notification.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "push_subscriptions",
        // A push endpoint URL is a globally unique handle for a single
        // (browser, push-provider, VAPID) tuple, so it must be the table's
        // identity key — NOT a `(user_id, endpoint)` composite. Allowing
        // two user_ids to point at the same physical channel produced
        // exactly the cross-profile bug we hit: a single WNS/FCM channel
        // shared between Edge regular and Edge InPrivate would receive
        // pushes intended for two different users, but only deliver them
        // to whichever browser originally claimed the channel.
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_push_subscription_endpoint",
                        columnNames = {"endpoint"}
                )
        },
        indexes = {
                @Index(name = "idx_push_subscription_user_id", columnList = "user_id")
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PushSubscription {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 1024)
    private String endpoint;

    @Column(name = "p256dh_key", nullable = false, length = 512)
    private String p256dhKey;

    @Column(name = "auth_key", nullable = false, length = 512)
    private String authKey;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

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
