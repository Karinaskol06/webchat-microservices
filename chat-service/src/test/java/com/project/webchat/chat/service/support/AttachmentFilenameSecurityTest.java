package com.project.webchat.chat.service.support;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AttachmentFilenameSecurityTest {

    @Test
    void containsMaliciousPattern_detectsTraversalAndScripts() {
        assertThat(AttachmentFilenameSecurity.containsMaliciousPattern("../secret.png")).isTrue();
        assertThat(AttachmentFilenameSecurity.containsMaliciousPattern("evil\\file.jpg")).isTrue();
        assertThat(AttachmentFilenameSecurity.containsMaliciousPattern("x%00.jpg")).isTrue();
        assertThat(AttachmentFilenameSecurity.containsMaliciousPattern("script-alert.png")).isTrue();
        assertThat(AttachmentFilenameSecurity.containsMaliciousPattern("shell.php")).isTrue();
        assertThat(AttachmentFilenameSecurity.containsMaliciousPattern(null)).isTrue();
    }

    @Test
    void containsMaliciousPattern_allowsSafeNames() {
        assertThat(AttachmentFilenameSecurity.containsMaliciousPattern("photo.png")).isFalse();
        assertThat(AttachmentFilenameSecurity.containsMaliciousPattern("документ.pdf")).isFalse();
    }

    @Test
    void sanitizeFilename_stripsPathAndUnsafeChars() {
        assertThat(AttachmentFilenameSecurity.sanitizeFilename("/tmp/evil file!.png"))
                .isEqualTo("evil_file_.png");
        assertThat(AttachmentFilenameSecurity.sanitizeFilename("C:\\Users\\doc.pdf"))
                .isEqualTo("doc.pdf");
        assertThat(AttachmentFilenameSecurity.sanitizeFilename(null)).isEqualTo("unknown");
        assertThat(AttachmentFilenameSecurity.sanitizeFilename("***")).isEqualTo("unknown");
    }

    @Test
    void isValidFileType_matchesPngMagicBytes() {
        byte[] pngHeader = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0};
        assertThat(AttachmentFilenameSecurity.isValidFileType(pngHeader, ".png")).isTrue();
        assertThat(AttachmentFilenameSecurity.isValidFileType(new byte[]{0, 0, 0, 0}, ".png")).isFalse();
    }

    @Test
    void isValidFileType_rejectsMismatchedExtension() {
        byte[] jpegHeader = new byte[]{(byte) 0xFF, (byte) 0xD8, 0, 0, 0, 0, 0, 0};
        assertThat(AttachmentFilenameSecurity.isValidFileType(jpegHeader, ".png")).isFalse();
    }
}
