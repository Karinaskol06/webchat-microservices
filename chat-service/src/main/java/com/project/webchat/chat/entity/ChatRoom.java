package com.project.webchat.chat.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

@Document(collection = "chat_rooms")
@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoom {

    @Id
    private String id;

    // PRIVATE, GROUP, CHANNEL
    private ChatType type;

    /**
     * Meaningful for GROUP and CHANNEL. Null on legacy documents — treat as PRIVATE when read.
     */
    private RoomVisibility visibility;

    @Builder.Default
    private Set<Long> memberIds = new HashSet<>();

    /**
     * GROUP: admins (invite, promotions). CHANNEL: promoted moderators (invite, promote posters, moderate messages).
     */
    @Builder.Default
    private Set<Long> adminIds = new HashSet<>();

    /**
     * CHANNEL only: members allowed to post without being creator or channel admin.
     */
    @Builder.Default
    private Set<Long> channelPosterIds = new HashSet<>();

    /** GROUP / CHANNEL: users blocked from joining or rejoining. */
    @Builder.Default
    private Set<Long> bannedUserIds = new HashSet<>();

    /** Members who removed the chat from their sidebar (private chats stay for the other person). */
    @Builder.Default
    private Set<Long> hiddenForMemberIds = new HashSet<>();

    /**
     * Opaque invite token for private GROUP / CHANNEL rooms.
     */
    private String inviteToken;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    //for preview
    private String lastMessage;

    //for group chats
    private String groupName;
    private String groupPhoto;
    /** Optional topic / description for GROUP and CHANNEL. */
    private String description;
    private Long createdBy;

    @Builder.Default
    private LocalDateTime lastActivity = LocalDateTime.now();

    public void addMember(Long userId) {
        memberIds.add(userId);
    }

    public boolean isMember(Long userId) {
        if (userId == null || memberIds == null || memberIds.isEmpty()) {
            return false;
        }
        return memberIds.stream()
                .filter(Objects::nonNull)
                .anyMatch(id -> id.longValue() == userId.longValue());
    }

    public boolean isBanned(Long userId) {
        if (userId == null || bannedUserIds == null || bannedUserIds.isEmpty()) {
            return false;
        }
        return bannedUserIds.stream()
                .filter(Objects::nonNull)
                .anyMatch(id -> id.longValue() == userId.longValue());
    }

    public boolean isHiddenFor(Long userId) {
        if (userId == null || hiddenForMemberIds == null || hiddenForMemberIds.isEmpty()) {
            return false;
        }
        return hiddenForMemberIds.stream()
                .filter(Objects::nonNull)
                .anyMatch(id -> id.longValue() == userId.longValue());
    }

}
