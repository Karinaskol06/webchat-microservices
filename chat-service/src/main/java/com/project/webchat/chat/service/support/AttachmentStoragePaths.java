package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.Attachment;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;

/**
 * Finds the on-disk file for an attachment using this process's upload folder.
 * Mongo stores two location fields:
 * {@code storedFilename} — just the file name, e.g. {@code a1b2c3.jpg}. Stable across machines.
 * {@code filePath} — full path from the machine that uploaded, e.g. {@code C:\...\a1b2c3.jpg}.
 * Goes stale if this process uses a different {@code APP_UPLOAD_DIR}.
 * Lookup order: {@code uploadDir + storedFilename}, then {@code filePath} only if it still
 * sits inside {@code uploadDir}. Never follow {@code ../} out of the upload folder.
 */
public final class AttachmentStoragePaths {

    private AttachmentStoragePaths() {
    }

    /**
     * @param uploadRoot this process's {@code app.upload.dir} (already absolute after FileStorageService.init)
     * @return the file to stream, or empty → caller should 404
     */
    public static Optional<Path> resolveReadableFile(Path uploadRoot, Attachment attachment) {
        if (uploadRoot == null || attachment == null) {
            return Optional.empty();
        }
        Path root = uploadRoot.toAbsolutePath().normalize();

        // 1) Normal case: current upload folder + stored name (ignores a stale Windows/Linux filePath).
        Optional<Path> byStoredName = resolveUnderRoot(root, attachment.getStoredFilename())
                .filter(AttachmentStoragePaths::isReadableFile);
        if (byStoredName.isPresent()) {
            return byStoredName;
        }
        // 2) Old rows: filePath still points at a file in this same folder.
        return resolveInsideRoot(root, attachment.getFilePath())
                .filter(AttachmentStoragePaths::isReadableFile);
    }

    /** Join root + storedFilename, then reject anything that walks out of root. */
    private static Optional<Path> resolveUnderRoot(Path root, String storedFilename) {
        if (storedFilename == null || storedFilename.isBlank()) {
            return Optional.empty();
        }
        Path resolved = root.resolve(storedFilename).toAbsolutePath().normalize();
        if (!isInsideRoot(root, resolved)) {
            return Optional.empty();
        }
        return Optional.of(resolved);
    }

    /** Use Mongo filePath only when it is already a file under root (never a foreign host path). */
    private static Optional<Path> resolveInsideRoot(Path root, String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return Optional.empty();
        }
        Path resolved = Paths.get(filePath).toAbsolutePath().normalize();
        if (!isInsideRoot(root, resolved)) {
            return Optional.empty();
        }
        return Optional.of(resolved);
    }

    /** True only for a path strictly inside root, not root itself and not a parent/sibling. */
    private static boolean isInsideRoot(Path root, Path candidate) {
        return candidate.startsWith(root) && !candidate.equals(root);
    }

    private static boolean isReadableFile(Path path) {
        return Files.isRegularFile(path) && Files.isReadable(path);
    }
}
