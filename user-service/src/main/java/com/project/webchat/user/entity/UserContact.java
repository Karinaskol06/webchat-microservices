package com.project.webchat.user.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "user_contacts",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_user_contact_pair", columnNames = {"user_id", "contact_user_id"})
        },
        indexes = {
                @Index(name = "idx_user_contact_user", columnList = "user_id"),
                @Index(name = "idx_user_contact_contact", columnList = "contact_user_id")
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserContact {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "contact_user_id", nullable = false)
    private Long contactUserId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
