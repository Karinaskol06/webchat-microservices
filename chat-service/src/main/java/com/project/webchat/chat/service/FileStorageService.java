package com.project.webchat.chat.service;

import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.entity.FileType;
import com.project.webchat.chat.repository.AttachmentRepository;
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
                throw new IllegalArgumentException(
                        String.format("File size (%d bytes) exceeds maximum allowed (%d bytes). " +
                                        "Max size: %d MB", file.getSize(), maxSize, maxSize / 1024 / 1024)
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
            if (!allowedExtensionSet.contains(extensionWithoutDot.toLowerCase())) {
                throw new IllegalArgumentException(
                        String.format("File extension '%s' is not allowed. Allowed: %s",
                                extension, allowedExtensionSet)
                );
            }

            // Malicious file names detection
            if (containsMaliciousPattern(originalFilename)) {
                throw new IllegalArgumentException("Filename contains invalid characters");
            }

            // Basic MIME type check to avoid extension spoofing
            // create byte array for header
            // different file types have unique first few bytes
            byte[] fileHeader = new byte[8];
            try (InputStream is = file.getInputStream()) {
                if (is.read(fileHeader) < 8) {
                    throw new IllegalArgumentException("File is too small or corrupted");
                }
            }
            // verify magic number matches extension
            if (!isValidFileType(fileHeader, extension)) {
                throw new IllegalArgumentException("File content does not match its extension");
            }

            // Generating a safe filename
            String safeStoredFilename = generateSafeFilename(extension);
            Path targetPath = uploadPath.resolve(safeStoredFilename);

            // Safe copying - prevents several common files problems
            try (InputStream inputStream = file.getInputStream()) {
                // uploaded file data, path where to save on a server, if exists - overwrite
                Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
            } // automatically closes input stream

            // Creating db record
            Attachment attachment = Attachment.builder()
                    .id(UUID.randomUUID().toString())
                    .filename(sanitizeFilename(originalFilename))
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
            throw new RuntimeException("Failed to save file: " + e.getMessage(), e);
        }
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

    /* helper methods */

    private String getFileExtension(String filename) {
        if (filename == null || filename.lastIndexOf('.') == -1) {
            return "";
        }
        // excludes text after the last dot
        return filename.substring(filename.lastIndexOf('.')).toLowerCase();
    }

    private boolean containsMaliciousPattern(String filename) {
        if (filename == null) return true;

        String lower = filename.toLowerCase();
        // Prohibited patterns
        return lower.contains("..") ||          // Path traversal
                lower.contains("/") ||           // Unix path
                lower.contains("\\") ||          // Windows path
                lower.contains("%00") ||         // Null byte injection
                lower.contains("script") ||      // XSS
                // Dangerous extensions
                lower.matches(".*\\.(php|jsp|asp|aspx|exe|bat|sh|cmd|vbs|ps1).*");
    }

    private boolean isValidFileType(byte[] header, String extension) {
        if (header == null || header.length < 4) return false;

        // magic numbers for different types of files
        switch (extension.toLowerCase()) {
            case ".jpg":
            case ".jpeg":
                return header[0] == (byte) 0xFF && header[1] == (byte) 0xD8;

            case ".png":
                return header[0] == (byte) 0x89 && header[1] == (byte) 0x50 &&
                        header[2] == (byte) 0x4E && header[3] == (byte) 0x47;

            case ".gif":
                return (header[0] == (byte) 0x47 && header[1] == (byte) 0x49 && header[2] == (byte) 0x46) ||
                        (header[0] == (byte) 0x47 && header[1] == (byte) 0x49 && header[2] == (byte) 0x46 && header[3] == (byte) 0x38);

            case ".pdf":
                return header[0] == (byte) 0x25 && header[1] == (byte) 0x50 &&
                        header[2] == (byte) 0x44 && header[3] == (byte) 0x46;

            case ".txt":
                return true;

            case ".doc":
            case ".xls":
            case ".ppt":
                // OLE2 (CFB) header
                return header[0] == (byte) 0xD0 && header[1] == (byte) 0xCF &&
                        header[2] == (byte) 0x11 && header[3] == (byte) 0xE0;

            case ".docx":
            case ".xlsx":
            case ".pptx":
                // ZIP header (Office Open XML)
                return header[0] == (byte) 0x50 && header[1] == (byte) 0x4B;

            default:
                return true;
        }
    }

    private String generateSafeFilename(String extension) {
        return UUID.randomUUID().toString() + extension;
    }

    private String sanitizeFilename(String filename) {
        if (filename == null) return "unknown";

        // deleting dangerous symbols
        return filename.replaceAll("[^a-zA-Z0-9.\\-_]", "_")
                .replaceAll("_{2,}", "_")
                .substring(0, Math.min(filename.length(), 255));
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
            default -> "application/octet-stream";
        };
    }


}
