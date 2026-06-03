package com.project.webchat.chat.service;

import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.entity.FileType;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.service.support.AttachmentFilenameSecurity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileStorageService {

    private final AttachmentRepository attachmentRepository;

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Value("${app.upload.max-size}")
    private long maxSize;

    @Value("${app.upload.allowed-extensions}")
    private String allowedExtensions;

    private Set<String> allowedExtensionSet;
    private Path uploadPath;

    @PostConstruct
    public void init() {
        try {
            // Initializing a set of allowed extensions
            allowedExtensionSet = Arrays.stream(allowedExtensions.toLowerCase().split(","))
                    .map(String::trim)
                    .collect(Collectors.toSet());

            // Creating a directory for uploads
            this.uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
                log.info("Created upload directory: {}", uploadPath);
            }
        } catch (IOException e) {
            log.error("Failed to initialize upload directory: {}", e.getMessage());
            throw new RuntimeException("Failed to initialize file storage", e);
        }
    }

    // Saving a file with security validation
    public Attachment saveFile(MultipartFile file, Long userId, String messageId, String chatId) {
        try {
            // Empty file validation
            if (file == null || file.isEmpty()) {
                throw new IllegalArgumentException("File is empty or null");
            }

            // Size validation
            if (file.getSize() > maxSize) {
                long maxMb = Math.max(1, maxSize / 1024 / 1024);
                throw new IllegalArgumentException(
                        String.format("File is too large. Maximum size is %d MB.", maxMb)
                );
            }

            // Authentic name validation (to avoid null pointer
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || originalFilename.trim().isEmpty()) {
                throw new IllegalArgumentException("Invalid filename");
            }

            // File extension validation
            String extension = getFileExtension(originalFilename);
            String extensionWithoutDot = extension.startsWith(".") ? extension.substring(1) : extension;
            String allowedList = allowedExtensionSet.stream()
                    .sorted()
                    .collect(Collectors.joining(", "));
            if (extensionWithoutDot.isBlank()) {
                throw new IllegalArgumentException(
                        String.format(
                                "This file has no extension. Allowed types: %s.",
                                allowedList
                        )
                );
            }
            if (!allowedExtensionSet.contains(extensionWithoutDot.toLowerCase())) {
                throw new IllegalArgumentException(
                        String.format(
                                "This file type is not allowed (.%s). Allowed types: %s.",
                                extensionWithoutDot.toLowerCase(),
                                allowedList
                        )
                );
            }

            // Malicious file names detection
            if (AttachmentFilenameSecurity.containsMaliciousPattern(originalFilename)) {
                throw new IllegalArgumentException("Filename contains invalid characters");
            }

            // Generating a safe filename
            String safeStoredFilename = generateSafeFilename(extension);
            Path targetPath = uploadPath.resolve(safeStoredFilename);

            // Write once — lazy multipart streams cannot be read via getInputStream() twice.
            file.transferTo(targetPath);

            // Magic-byte check on the saved file (avoids consuming the upload stream twice).
            byte[] fileHeader = readFileHeader(targetPath, 12);
            if (!AttachmentFilenameSecurity.isValidFileType(fileHeader, extension)) {
                Files.deleteIfExists(targetPath);
                throw new IllegalArgumentException(
                        "This file doesn't match its type. It may be corrupted or renamed with the wrong extension."
                );
            }

            // Creating db record
            Attachment attachment = Attachment.builder()
                    .id(UUID.randomUUID().toString())
                    .filename(AttachmentFilenameSecurity.sanitizeFilename(originalFilename))
                    .storedFilename(safeStoredFilename)
                    .filePath(targetPath.toAbsolutePath().toString())
                    .size(file.getSize())
                    .mimeType(detectMimeTypeFromExtension(extension))
                    .fileType(determineFileType(extension))
                    .chatId(chatId)
                    .uploaderId(userId)
                    .messageId(messageId)
                    .createdAt(LocalDateTime.now())
                    .build();

            Attachment saved = attachmentRepository.save(attachment);
            log.info("File saved successfully: {} -> {} (user: {}, chat: {})",
                    originalFilename, safeStoredFilename, userId, chatId);

            return saved;
        } catch (IOException e) {
            log.error("Error saving file: {}", e.getMessage(), e);
            throw new IllegalArgumentException("Failed to save file. Try again or use a different file.", e);
        }
    }

    private byte[] readFileHeader(Path path, int length) throws IOException {
        byte[] fileHeader = new byte[length];
        try (InputStream is = Files.newInputStream(path)) {
            int offset = 0;
            while (offset < length) {
                int read = is.read(fileHeader, offset, length - offset);
                if (read < 0) {
                    Files.deleteIfExists(path);
                    throw new IllegalArgumentException("File is too small or corrupted");
                }
                offset += read;
            }
        } catch (IllegalArgumentException e) {
            throw e;
        }
        return fileHeader;
    }

    // Safe file saving without message connection
    public Attachment saveFile(MultipartFile file, Long userId, String chatId) {
        // messageId is unknown at upload-time; chatId must be preserved for auth checks
        return saveFile(file, userId, null, chatId);
    }

    // Receiving file for download
    public Path getFilePath(String attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new RuntimeException("Attachment not found: " + attachmentId));

        Path filePath = Paths.get(attachment.getFilePath());
        if (!Files.exists(filePath) || !Files.isReadable(filePath)) {
            throw new RuntimeException("File not found or not readable: " + attachmentId);
        }

        return filePath;
    }

    public void deleteFile(String attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new RuntimeException("Attachment not found: " + attachmentId));

        try {
            Path filePath = Paths.get(attachment.getFilePath());
            Files.deleteIfExists(filePath);
            attachmentRepository.delete(attachment);
            log.info("File deleted: {} ({})", attachment.getFilename(), attachmentId);
        } catch (IOException e) {
            log.error("Failed to delete file: {}", attachmentId, e);
            throw new RuntimeException("Failed to delete file", e);
        }
    }

    // Getting all message attachments
    public List<Attachment> getMessageAttachments(String messageId) {
        return attachmentRepository.findByMessageId(messageId);
    }

    // Connects message with attachment
    public void attachToMessage(String attachmentId, String messageId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new RuntimeException("Attachment not found: " + attachmentId));
        attachment.setMessageId(messageId);
        attachmentRepository.save(attachment);
        log.info("Attachment {} attached to message {}", attachmentId, messageId);
    }

    public Attachment getAttachmentById(String attachmentId) {
        return attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new RuntimeException("Attachment wasn't found"));
    }

    /**
     * Copies the stored file and creates a new attachment row for a forwarded message
     * (each message owns its files so deletes and chat scoping stay correct).
     */
    public Attachment cloneAttachmentForForward(Attachment source, String newMessageId, String targetChatId,
                                              Long uploaderId) {
        try {
            Path sourcePath = Paths.get(source.getFilePath()).toAbsolutePath().normalize();
            if (!Files.exists(sourcePath) || !Files.isRegularFile(sourcePath)) {
                throw new IllegalArgumentException("Original file is missing for this attachment.");
            }

            String extension = getFileExtension(source.getFilename());
            if ((extension == null || extension.isEmpty()) && source.getStoredFilename() != null
                    && source.getStoredFilename().contains(".")) {
                extension = source.getStoredFilename().substring(source.getStoredFilename().lastIndexOf('.'));
            }
            if (extension == null || extension.isEmpty()) {
                extension = ".bin";
            }
            String normalizedExt = extension.startsWith(".") ? extension : "." + extension;
            String safeStoredFilename = UUID.randomUUID().toString() + normalizedExt;
            Path targetPath = uploadPath.resolve(safeStoredFilename);
            Files.copy(sourcePath, targetPath, StandardCopyOption.REPLACE_EXISTING);

            Attachment clone = Attachment.builder()
                    .id(UUID.randomUUID().toString())
                    .filename(source.getFilename())
                    .storedFilename(safeStoredFilename)
                    .filePath(targetPath.toAbsolutePath().toString())
                    .size(source.getSize())
                    .mimeType(source.getMimeType())
                    .fileType(source.getFileType())
                    .chatId(targetChatId)
                    .uploaderId(uploaderId)
                    .messageId(newMessageId)
                    .createdAt(LocalDateTime.now())
                    .build();
            return attachmentRepository.save(clone);
        } catch (IOException e) {
            log.error("Failed to clone attachment for forward: {}", e.getMessage());
            throw new RuntimeException("Failed to clone attachment for forward", e);
        }
    }

    /* helper methods */

    private String getFileExtension(String filename) {
        if (filename == null || filename.lastIndexOf('.') == -1) {
            return "";
        }
        // excludes text after the last dot
        return filename.substring(filename.lastIndexOf('.')).toLowerCase();
    }

    private String generateSafeFilename(String extension) {
        return UUID.randomUUID().toString() + extension;
    }

    // Determine file type base on extension
    private FileType determineFileType(String extension) {
        String ext = extension.toLowerCase();

        if (ext.matches("\\.(jpg|jpeg|png|gif|webp|bmp|svg)")) {
            return FileType.IMAGE;
        }
        if (ext.matches("\\.(mp4|avi|mov|wmv|flv|mkv|webm)")) {
            return FileType.VIDEO;
        }
        if (ext.matches("\\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|odt|ods)")) {
            return FileType.DOCUMENT;
        }
        return FileType.OTHER;
    }

    // Identify MIME type based on extension
    private String detectMimeTypeFromExtension(String extension) {
        return switch (extension.toLowerCase()) {
            case ".jpg", ".jpeg" -> "image/jpeg";
            case ".png" -> "image/png";
            case ".gif" -> "image/gif";
            case ".pdf" -> "application/pdf";
            case ".txt" -> "text/plain";
            case ".doc" -> "application/msword";
            case ".docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case ".xls" -> "application/vnd.ms-excel";
            case ".xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case ".mp4" -> "video/mp4";
            case ".webp" -> "image/webp";
            default -> "application/octet-stream";
        };
    }
}
