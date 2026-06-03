package com.project.webchat.user.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.Set;

/**
 * Validates profile avatar / cover uploads by size, extension, and image magic bytes
 * (not only the browser-reported Content-Type, which is often missing or wrong).
 */
public final class ProfileImageUploadValidator {

    public static final long MAX_BYTES = 10L * 1024L * 1024L;
    public static final int MAX_MB = 10;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private ProfileImageUploadValidator() {
    }

    public static void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Image file is required");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException(
                    String.format("Image is too large. Maximum size is %d MB.", MAX_MB)
            );
        }

        byte[] data;
        try {
            data = file.getBytes();
        } catch (Exception e) {
            throw new IllegalArgumentException("Unable to read uploaded file", e);
        }
        validateImageBytes(data, file.getOriginalFilename(), file.getContentType());
    }

    static void validateImageBytes(byte[] data, String originalFilename, String reportedContentType) {
        if (data == null || data.length == 0) {
            throw new IllegalArgumentException("Image file is empty or corrupted");
        }
        if (data.length > MAX_BYTES) {
            throw new IllegalArgumentException(
                    String.format("Image is too large. Maximum size is %d MB.", MAX_MB)
            );
        }

        String extension = extensionWithoutDot(originalFilename);
        if (extension.isBlank()) {
            throw new IllegalArgumentException(
                    "Image must have a file extension. Allowed types: jpg, jpeg, png, webp."
            );
        }
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException(
                    String.format(
                            "Image type .%s is not allowed. Allowed types: jpg, jpeg, png, webp.",
                            extension
                    )
            );
        }

        int headerLen = Math.min(data.length, 12);
        byte[] header = new byte[headerLen];
        System.arraycopy(data, 0, header, 0, headerLen);

        String detectedMime = detectMimeFromMagic(header);
        if (detectedMime == null) {
            throw new IllegalArgumentException(
                    "This file doesn't look like a supported image. Use PNG, JPEG, or WebP."
            );
        }

        if (!mimeMatchesExtension(detectedMime, extension)) {
            throw new IllegalArgumentException(
                    "This image doesn't match its file extension. Rename the file or convert it to PNG, JPEG, or WebP."
            );
        }

        String reported = normalizeReportedMime(reportedContentType);
        if (reported != null && !ALLOWED_MIME_TYPES.contains(reported)) {
            throw new IllegalArgumentException("Only PNG, JPEG and WebP images are allowed");
        }
    }

    private static String detectMimeFromMagic(byte[] header) {
        if (header.length >= 3 && header[0] == (byte) 0xFF && header[1] == (byte) 0xD8 && header[2] == (byte) 0xFF) {
            return "image/jpeg";
        }
        if (header.length >= 8
                && header[0] == (byte) 0x89
                && header[1] == (byte) 0x50
                && header[2] == (byte) 0x4E
                && header[3] == (byte) 0x47) {
            return "image/png";
        }
        if (header.length >= 12
                && header[0] == 'R'
                && header[1] == 'I'
                && header[2] == 'F'
                && header[3] == 'F'
                && header[8] == 'W'
                && header[9] == 'E'
                && header[10] == 'B'
                && header[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    private static boolean mimeMatchesExtension(String mime, String extension) {
        return switch (mime) {
            case "image/jpeg" -> extension.equals("jpg") || extension.equals("jpeg");
            case "image/png" -> extension.equals("png");
            case "image/webp" -> extension.equals("webp");
            default -> false;
        };
    }

    private static String normalizeReportedMime(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }
        String normalized = contentType.toLowerCase(Locale.ROOT).trim();
        if (normalized.startsWith("image/jpg") || normalized.equals("image/pjpeg")) {
            return "image/jpeg";
        }
        int semi = normalized.indexOf(';');
        if (semi > 0) {
            normalized = normalized.substring(0, semi).trim();
        }
        return normalized;
    }

    private static String extensionWithoutDot(String filename) {
        if (filename == null || filename.isBlank()) {
            return "";
        }
        String base = filename.trim();
        int slash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
        if (slash >= 0) {
            base = base.substring(slash + 1);
        }
        int dot = base.lastIndexOf('.');
        if (dot <= 0 || dot == base.length() - 1) {
            return "";
        }
        return base.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
