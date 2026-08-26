package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.Attachment;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class AttachmentStoragePathsTest {

    @TempDir
    Path uploadDir;

    @Test
    void resolveReadableFile_usesStoredFilenameWhenLegacyPathIsStale() throws Exception {
        Path stored = uploadDir.resolve("a1b2c3.jpg");
        Files.write(stored, new byte[] {1, 2, 3});

        Attachment attachment = Attachment.builder()
                .storedFilename("a1b2c3.jpg")
                .filePath("C:\\old-host\\chat-uploads\\a1b2c3.jpg")
                .build();

        Optional<Path> resolved = AttachmentStoragePaths.resolveReadableFile(uploadDir, attachment);

        assertThat(resolved).contains(stored.toAbsolutePath().normalize());
    }

    @Test
    void resolveReadableFile_rejectsStoredFilenameOutsideUploadDir() throws Exception {
        Path secret = Files.createTempFile("secret", ".txt");
        Files.write(secret, new byte[] {9});

        Attachment attachment = Attachment.builder()
                .storedFilename("../" + secret.getFileName())
                .filePath(secret.toString())
                .build();

        assertThat(AttachmentStoragePaths.resolveReadableFile(uploadDir, attachment)).isEmpty();
    }

    @Test
    void resolveReadableFile_fallsBackToLegacyPathInsideUploadDir() throws Exception {
        Path legacyFile = uploadDir.resolve("legacy.jpg");
        Files.write(legacyFile, new byte[] {4, 5, 6});

        Attachment attachment = Attachment.builder()
                .storedFilename("missing-now.jpg")
                .filePath(legacyFile.toAbsolutePath().toString())
                .build();

        Optional<Path> resolved = AttachmentStoragePaths.resolveReadableFile(uploadDir, attachment);

        assertThat(resolved).contains(legacyFile.toAbsolutePath().normalize());
    }

    @Test
    void resolveReadableFile_ignoresLegacyPathOutsideUploadDir() throws Exception {
        Path outside = Files.createTempFile("outside", ".jpg");
        Files.write(outside, new byte[] {7, 8});

        Attachment attachment = Attachment.builder()
                .storedFilename("not-here.jpg")
                .filePath(outside.toAbsolutePath().toString())
                .build();

        assertThat(AttachmentStoragePaths.resolveReadableFile(uploadDir, attachment)).isEmpty();
    }

    @Test
    void resolveReadableFile_isEmptyWhenBytesAreMissing() {
        Attachment attachment = Attachment.builder()
                .storedFilename("gone.jpg")
                .filePath(uploadDir.resolve("also-gone.jpg").toString())
                .build();

        assertThat(AttachmentStoragePaths.resolveReadableFile(uploadDir, attachment)).isEmpty();
    }
}
