package com.project.webchat.user.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "user_bans",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_ban_pair", columnNames = {"user_id", "banned_user_id"})
        },
        indexes = {
                @Index(name = "idx_user_ban_user", columnList = "user_id"),
                @Index(name = "idx_user_ban_target", columnList = "banned_user_id")
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** User who initiated the ban. */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** User who was banned by {@link #userId}. */
    @Column(name = "banned_user_id", nullable = false)
    private Long bannedUserId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
