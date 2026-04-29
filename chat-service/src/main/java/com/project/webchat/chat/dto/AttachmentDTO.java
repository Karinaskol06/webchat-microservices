package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.Attachment;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AttachmentDTO {
    private String id;
    private String messageId;
    private String filename;
    private String storedFilename;
    private Long size;
    private String mimeType;
    private String fileType;
    private String createdAt;
    private String downloadUrl;

    private boolean isImage;

    public static AttachmentDTO fromEntity(Attachment attachment, String baseUrl) {
        return AttachmentDTO.builder()
                .id(attachment.getId())
                .messageId(attachment.getMessageId())
                .filename(attachment.getFilename())
                .size(attachment.getSize())
                .mimeType(attachment.getMimeType())
                .fileType(attachment.getFileType().toString())
                .createdAt(attachment.getCreatedAt().toString())
                .downloadUrl(baseUrl + "/api/chat/attachments/" + attachment.getId())
                .isImage(attachment.isImage())
                .build();
    }

    public static AttachmentDTO fromEntity(Attachment attachment) {
        return AttachmentDTO.builder()
                .id(attachment.getId())
                .messageId(attachment.getMessageId())
                .filename(attachment.getFilename())
                .size(attachment.getSize())
                .mimeType(attachment.getMimeType())
                .fileType(attachment.getFileType().toString())
                .createdAt(attachment.getCreatedAt().toString())
                .downloadUrl("/api/chat/attachments/" + attachment.getId())
                .isImage(attachment.isImage())
                .build();
    }
}
