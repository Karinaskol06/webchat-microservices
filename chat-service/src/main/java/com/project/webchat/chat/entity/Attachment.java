package com.project.webchat.chat.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "attachments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Attachment {

    @Id
    private String id;

    private String filename;

    private String storedFilename; // must be unique

    private Long size; // in bytes

    private FileType fileType; //IMAGE, FILE

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private String filePath;

    private String mimeType;

    // Connections to existent entities
    private String messageId;

    private String chatId;

    private Long uploaderId;

    public boolean isImage() {
        return fileType == FileType.IMAGE;
    }

}
