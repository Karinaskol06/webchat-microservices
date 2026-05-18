package com.project.webchat.chat.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatMessageDTO {
    private String id;
    private String chatId;
    private String content;
    private MessageType messageType;
    private LocalDateTime timestamp;
    private LocalDateTime editedAt;
    private boolean isRead;
    private LocalDateTime readAt;
    private String replyToMessageId;
    private ReplyPreviewDTO repliedMessage;

    /** Present when this message was forwarded; click opens original author's profile. */
    private UserInfoDTO forwardedFrom;

    //for websocket (MESSAGE, WRITING, READ_RECEIPT)
    private String type;

    private UserInfoDTO sender;
    private List<AttachmentDTO> attachments;
    private List<MessageReactionDTO> reactions;

    public static ChatMessageDTO toDTO(ChatMessage chatMessage, UserInfoDTO sender) {
        return ChatMessageDTO.builder()
                .id(chatMessage.getId())
                .chatId(chatMessage.getChatId())
                .sender(sender)
                .content(chatMessage.getContent())
                .messageType(chatMessage.getMessageType())
                .timestamp(chatMessage.getTimestamp())
                .editedAt(chatMessage.getEditedAt())
                .isRead(chatMessage.isRead())
                .readAt(chatMessage.getReadAt())
                .replyToMessageId(chatMessage.getReplyToMessageId())
                .type("MESSAGE")
                .build();
    }

}
