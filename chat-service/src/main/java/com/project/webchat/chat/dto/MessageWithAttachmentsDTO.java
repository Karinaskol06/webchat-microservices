package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.entity.ChatMessage;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageWithAttachmentsDTO {
    private String id;
    private String chatId;
    private Long senderId;
    private String senderName;
    private String content; // message text
    private LocalDateTime timestamp;
    private List<AttachmentDTO> attachments;
    private String messageType; // TEXT, IMAGE, FILE, VIDEO, MIXED

    public static MessageWithAttachmentsDTO fromEntity(ChatMessage message, List<Attachment> attachments) {
        MessageWithAttachmentsDTO messageWithAttachmentsDTO = new MessageWithAttachmentsDTO();

        List<AttachmentDTO> attachmentDTOs = attachments.stream()
                .map(AttachmentDTO::fromEntity)
                .toList();

        messageWithAttachmentsDTO.setId(message.getId());
        messageWithAttachmentsDTO.setChatId(message.getChatId());
        messageWithAttachmentsDTO.setSenderId(message.getSenderId());
        messageWithAttachmentsDTO.setSenderName(message.getSenderName());
        messageWithAttachmentsDTO.setContent(message.getContent());
        messageWithAttachmentsDTO.setTimestamp(message.getTimestamp());
        messageWithAttachmentsDTO.setMessageType(message.getMessageType() != null ? message.getMessageType().name() : "TEXT");
        messageWithAttachmentsDTO.setAttachments(attachmentDTOs);

        return messageWithAttachmentsDTO;
    }
}
