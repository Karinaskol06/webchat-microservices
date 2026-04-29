package com.project.webchat.chat.controller;

import com.project.webchat.chat.dto.AttachmentDTO;
import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.security.CustomUserDetails;
import com.project.webchat.chat.service.ChatService;
import com.project.webchat.chat.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Slf4j
public class AttachmentController {

    private final FileStorageService fileStorageService;
    private final ChatService chatService;

    @PostMapping("/{chatId}/attachments")
    public ResponseEntity<List<AttachmentDTO>> uploadAttachments(
            @PathVariable String chatId,
            @RequestParam("files") List<MultipartFile> files,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        if (!chatService.isUserChatMember(chatId, currentUser.getId())) {
            return ResponseEntity.status(403).build();
        }

        List<AttachmentDTO> attachments = files.stream()
                .map(file -> fileStorageService.saveFile(file, currentUser.getId(), chatId))
                .map(AttachmentDTO::fromEntity)
                .toList();

        return ResponseEntity.ok(attachments);
    }

    @GetMapping("/attachments/{attachmentId}")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable String attachmentId,
            @RequestParam(name = "download", defaultValue = "false") boolean forceDownload,
            @RequestParam(name = "token", required = false) String token,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        Attachment attachment = fileStorageService.getAttachmentById(attachmentId);
        boolean isMember = chatService.isUserChatMember(attachment.getChatId(), currentUser.getId());

        if (!isMember) {
            return ResponseEntity.status(403).build();
        }

        FileSystemResource resource = new FileSystemResource(attachment.getFilePath());
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }

        MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
        try {
            mediaType = MediaType.parseMediaType(attachment.getMimeType());
        } catch (Exception ignored) {
        }

        boolean isInlinePreview = !forceDownload
                && (attachment.getMimeType() != null)
                && (attachment.getMimeType().startsWith("image/")
                || attachment.getMimeType().startsWith("video/"));
        String disposition = (isInlinePreview ? "inline" : "attachment")
                + "; filename=\"" + attachment.getFilename() + "\"";

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .body(resource);
    }
}
