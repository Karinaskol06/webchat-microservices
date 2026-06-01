package com.project.webchat.chat.service.support;

/**
 * Filename and magic-byte checks for attachment uploads (used by {@link com.project.webchat.chat.service.FileStorageService}).
 */
public final class AttachmentFilenameSecurity {

    private AttachmentFilenameSecurity() {
    }

    public static boolean containsMaliciousPattern(String filename) {
        if (filename == null) {
            return true;
        }

        String lower = filename.toLowerCase();
        return lower.contains("..")
                || lower.contains("/")
                || lower.contains("\\")
                || lower.contains("%00")
                || lower.contains("script")
                || lower.matches(".*\\.(php|jsp|asp|aspx|exe|bat|sh|cmd|vbs|ps1).*");
    }

    public static String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "unknown";
        }

        String base = filename.strip();
        int lastSep = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
        if (lastSep >= 0) {
            base = base.substring(lastSep + 1).strip();
        }
        if (base.isBlank()) {
            return "unknown";
        }

        String sanitized = base.replaceAll("[^\\p{L}\\p{M}\\p{N}.\\-_]", "_")
                .replaceAll("_{2,}", "_")
                .replaceAll("^_+|_+$", "");
        if (sanitized.isBlank()) {
            return "unknown";
        }
        return sanitized.substring(0, Math.min(sanitized.length(), 255));
    }

    public static boolean isValidFileType(byte[] header, String extension) {
        if (header == null || header.length < 4) {
            return false;
        }

        return switch (extension.toLowerCase()) {
            case ".jpg", ".jpeg" -> header[0] == (byte) 0xFF && header[1] == (byte) 0xD8;
            case ".png" -> header[0] == (byte) 0x89 && header[1] == (byte) 0x50
                    && header[2] == (byte) 0x4E && header[3] == (byte) 0x47;
            case ".gif" -> (header[0] == (byte) 0x47 && header[1] == (byte) 0x49 && header[2] == (byte) 0x46)
                    || (header[0] == (byte) 0x47 && header[1] == (byte) 0x49 && header[2] == (byte) 0x46
                    && header[3] == (byte) 0x38);
            case ".pdf" -> header[0] == (byte) 0x25 && header[1] == (byte) 0x50
                    && header[2] == (byte) 0x44 && header[3] == (byte) 0x46;
            case ".txt" -> true;
            case ".doc", ".xls", ".ppt" -> header[0] == (byte) 0xD0 && header[1] == (byte) 0xCF
                    && header[2] == (byte) 0x11 && header[3] == (byte) 0xE0;
            case ".docx", ".xlsx", ".pptx" -> header[0] == (byte) 0x50 && header[1] == (byte) 0x4B;
            default -> true;
        };
    }
}
