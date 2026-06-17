package com.project.webchat.chat.service.support;

import com.project.webchat.chat.dto.AttachmentDTO;
import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ForwardedRoomDTO;
import com.project.webchat.chat.dto.MessageReactionDTO;
import com.project.webchat.chat.dto.ReplyPreviewDTO;
import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.entity.MessageReaction;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class ChatMessageMapper {

    private final AttachmentRepository attachmentRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatUserInfoService chatUserInfoService;
    private final ChatMessagePreviewHelper previewHelper;

    public ChatMessageDTO toMessageDTO(ChatMessage message, UserInfoDTO senderInfo) {
        return toMessageDTO(message, senderInfo, null);
    }

    public ChatMessageDTO toMessageDTO(ChatMessage message, UserInfoDTO senderInfo, Long viewerUserId) {
        ChatMessageDTO dto = ChatMessageDTO.toDTO(message, senderInfo);

        Map<String, AttachmentDTO> attachmentMap = new LinkedHashMap<>();

        if (message.getAttachmentIds() != null && !message.getAttachmentIds().isEmpty()) {
            attachmentRepository.findAllById(message.getAttachmentIds())
                    .stream()
                    .map(AttachmentDTO::fromEntity)
                    .forEach(att -> attachmentMap.put(att.getId(), att));
        }

        attachmentRepository.findByMessageId(message.getId())
                .stream()
                .map(AttachmentDTO::fromEntity)
                .forEach(att -> attachmentMap.put(att.getId(), att));

        dto.setAttachments(new ArrayList<>(attachmentMap.values()));
        dto.setRepliedMessage(buildReplyPreview(message));
        enrichForwardMetadata(message, dto);
        dto.setReactions(toReactionDtos(message.getReactions(), viewerUserId));
        return dto;
    }

    public List<MessageReactionDTO> toReactionDtos(List<MessageReaction> reactions, Long currentUserId) {
        if (reactions == null || reactions.isEmpty()) {
            return List.of();
        }
        return reactions.stream()
                .filter(r -> r.getUserIds() != null && !r.getUserIds().isEmpty())
                .map(r -> MessageReactionDTO.fromEntity(r, currentUserId))
                .toList();
    }

    public String normalizeReplyToMessageId(String replyToMessageId) {
        if (replyToMessageId == null || replyToMessageId.isBlank()) {
            return null;
        }
        return replyToMessageId.trim();
    }

    public List<Attachment> collectAttachmentsForMessage(ChatMessage source) {
        Map<String, Attachment> byId = new LinkedHashMap<>();
        if (source.getAttachmentIds() != null) {
            for (String id : source.getAttachmentIds()) {
                if (id == null || id.isBlank()) {
                    continue;
                }
                attachmentRepository.findById(id.trim()).ifPresent(att -> byId.put(att.getId(), att));
            }
        }
        attachmentRepository.findByMessageId(source.getId())
                .forEach(att -> byId.put(att.getId(), att));
        return new ArrayList<>(byId.values());
    }

    public ForwardOrigin buildForwardOriginFromSource(ChatMessage source) {
        ChatRoom sourceRoom = null;
        if (source.getChatId() != null && !source.getChatId().isBlank()) {
            sourceRoom = chatRoomRepository.findById(source.getChatId()).orElse(null);
        }
        if (sourceRoom != null) {
            ChatType roomType = sourceRoom.getType();
            if (roomType == ChatType.GROUP || roomType == ChatType.CHANNEL) {
                String roomName = sourceRoom.getGroupName();
                if (roomName != null && !roomName.isBlank()) {
                    RoomVisibility visibility = sourceRoom.getVisibility() != null
                            ? sourceRoom.getVisibility()
                            : RoomVisibility.PRIVATE;
                    return ForwardOrigin.fromRoom(
                            sourceRoom.getId(),
                            roomName.trim(),
                            roomType,
                            visibility.name());
                }
            }
        }

        Long originAuthorId = source.getForwardedFromUserId() != null
                ? source.getForwardedFromUserId()
                : source.getSenderId();

        String username = source.getForwardedFromUsername();
        if (username == null || username.isBlank()) {
            UserInfoDTO originInfo = chatUserInfoService.getUserInfo(originAuthorId);
            if (originInfo != null && originInfo.getUsername() != null && !originInfo.getUsername().isBlank()) {
                username = originInfo.getUsername();
            } else if (originInfo != null) {
                username = originInfo.getDisplayName();
            }
        }
        if (username == null || username.isBlank()) {
            username = source.getSenderName() != null ? source.getSenderName() : "Unknown";
        }

        return ForwardOrigin.fromUser(originAuthorId, username);
    }

    private ReplyPreviewDTO buildReplyPreview(ChatMessage message) {
        String replyToMessageId = normalizeReplyToMessageId(message.getReplyToMessageId());
        if (replyToMessageId == null) {
            return null;
        }

        Optional<ChatMessage> parentOptional = chatMessageRepository.findById(replyToMessageId);
        if (parentOptional.isEmpty()) {
            return ReplyPreviewDTO.builder()
                    .messageId(replyToMessageId)
                    .deleted(true)
                    .build();
        }

        ChatMessage parent = parentOptional.get();
        UserInfoDTO senderInfo = chatUserInfoService.getUserInfo(parent.getSenderId());
        return ReplyPreviewDTO.builder()
                .messageId(parent.getId())
                .senderId(parent.getSenderId())
                .senderDisplayName(senderInfo != null ? senderInfo.getDisplayName() : parent.getSenderName())
                .content(previewHelper.getPreviewText(parent.getContent(),
                        attachmentRepository.findByMessageId(parent.getId()),
                        parent.getMessageType()))
                .messageType(parent.getMessageType())
                .deleted(false)
                .build();
    }

    private void enrichForwardMetadata(ChatMessage message, ChatMessageDTO dto) {
        if (message.getForwardedFromRoomId() != null && !message.getForwardedFromRoomId().isBlank()) {
            dto.setForwardedFromRoom(ForwardedRoomDTO.builder()
                    .id(message.getForwardedFromRoomId())
                    .name(message.getForwardedFromUsername())
                    .type(message.getForwardedFromRoomType())
                    .visibility(message.getForwardedFromRoomVisibility())
                    .build());
            if (message.getForwardedFromUsername() != null && !message.getForwardedFromUsername().isBlank()) {
                dto.setForwardedFrom(UserInfoDTO.builder()
                        .username(message.getForwardedFromUsername())
                        .build());
            }
            return;
        }

        if (message.getForwardedFromUserId() == null) {
            return;
        }
        UserInfoDTO enriched = chatUserInfoService.getUserInfo(message.getForwardedFromUserId());
        UserInfoDTO forwarded = UserInfoDTO.builder()
                .id(message.getForwardedFromUserId())
                .username(message.getForwardedFromUsername() != null && !message.getForwardedFromUsername().isBlank()
                        ? message.getForwardedFromUsername()
                        : (enriched != null ? enriched.getUsername() : null))
                .firstName(enriched != null ? enriched.getFirstName() : null)
                .lastName(enriched != null ? enriched.getLastName() : null)
                .profilePicture(enriched != null ? enriched.getProfilePicture() : null)
                .online(enriched != null && enriched.isOnline())
                .build();
        dto.setForwardedFrom(forwarded);
    }

    public record ForwardOrigin(
            Long userId,
            String username,
            String roomId,
            ChatType roomType,
            String roomVisibility) {

        public static ForwardOrigin fromUser(Long userId, String username) {
            return new ForwardOrigin(userId, username, null, null, null);
        }

        public static ForwardOrigin fromRoom(String roomId, String roomName, ChatType roomType, String visibility) {
            return new ForwardOrigin(null, roomName, roomId, roomType, visibility);
        }

        public boolean isRoom() {
            return roomId != null && !roomId.isBlank();
        }
    }
}
